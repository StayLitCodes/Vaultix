/**
 * #765 — Submit must not file a dispute while evidence uploads are still in
 * flight or have failed, otherwise the evidence is silently dropped.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { RaiseDisputeModal } from '../components/RaiseDisputeModal';
import { disputeApi } from '../services/api';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('../services/api', () => ({
  disputeApi: {
    uploadEvidence: jest.fn(),
  },
}));

const mockedPicker = DocumentPicker as jest.Mocked<typeof DocumentPicker>;
const mockedDisputeApi = disputeApi as jest.Mocked<typeof disputeApi>;

const PICKED_ASSET = {
  name: 'proof.png',
  uri: 'file:///proof.png',
  size: 1024,
  mimeType: 'image/png',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderModal(onSubmit = jest.fn().mockResolvedValue(undefined)) {
  render(
    <RaiseDisputeModal
      visible
      onClose={jest.fn()}
      onSubmit={onSubmit}
      isSubmitting={false}
      escrowId="escrow-1"
    />,
  );
  fireEvent.changeText(screen.getByPlaceholderText('e.g. Non-delivery, Quality issue'), 'Non-delivery');
  fireEvent.changeText(screen.getByPlaceholderText('Provide details...'), 'Goods never arrived');
  return onSubmit;
}

async function pickOneFile() {
  mockedPicker.getDocumentAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [PICKED_ASSET],
  } as unknown as DocumentPicker.DocumentPickerResult);
  fireEvent.press(screen.getByText('Tap to upload files'));
  await waitFor(() => expect(mockedDisputeApi.uploadEvidence).toHaveBeenCalledTimes(1));
}

const submitButton = () => screen.getByLabelText('Submit dispute');

describe('RaiseDisputeModal evidence gating (#765)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disables Submit while an evidence file is still uploading and explains why', async () => {
    mockedDisputeApi.uploadEvidence.mockReturnValue(new Promise(() => {}) as never);
    renderModal();

    expect(submitButton().props.accessibilityState).toEqual({ disabled: true });

    await pickOneFile();

    expect(submitButton().props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByText('Waiting for 1 file to finish uploading')).toBeTruthy();
  });

  it('does not file the dispute if Submit is tapped before the upload resolves', async () => {
    const upload = deferred<{ cid: string }>();
    mockedDisputeApi.uploadEvidence.mockReturnValue(upload.promise as never);
    const onSubmit = renderModal();
    await pickOneFile();

    // Force the press through even though the button is disabled.
    fireEvent.press(submitButton());
    await waitFor(() => expect(mockedDisputeApi.uploadEvidence).toHaveBeenCalled());
    expect(onSubmit).not.toHaveBeenCalled();

    upload.resolve({ cid: 'cid-1' });

    await waitFor(() => expect(screen.getByText('Uploaded')).toBeTruthy());
    expect(submitButton().props.accessibilityState).toEqual({ disabled: false });
    expect(screen.queryByText(/Waiting for/)).toBeNull();
  });

  it('files the dispute with the evidence once uploads settle', async () => {
    mockedDisputeApi.uploadEvidence.mockResolvedValue({ cid: 'cid-1' });
    const onSubmit = renderModal();
    await pickOneFile();

    await waitFor(() => expect(submitButton().props.accessibilityState).toEqual({ disabled: false }));
    fireEvent.press(submitButton());

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('Non-delivery', 'Goods never arrived', ['cid-1']),
    );
  });

  it('keeps Submit disabled and surfaces the failure when an upload errors', async () => {
    mockedDisputeApi.uploadEvidence.mockRejectedValue(new Error('IPFS unreachable'));
    const onSubmit = renderModal();
    await pickOneFile();

    await waitFor(() => expect(screen.getByText('IPFS unreachable')).toBeTruthy());
    expect(submitButton().props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByText('1 file failed to upload — retry or remove it')).toBeTruthy();

    fireEvent.press(submitButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('allows Submit once a failed file is removed', async () => {
    mockedDisputeApi.uploadEvidence.mockRejectedValue(new Error('IPFS unreachable'));
    const onSubmit = renderModal();
    await pickOneFile();
    await waitFor(() => expect(screen.getByText('IPFS unreachable')).toBeTruthy());

    // Remove the failed file entry, leaving no evidence at all.
    fireEvent.press(screen.getByLabelText('Remove proof.png'));
    await waitFor(() => expect(submitButton().props.accessibilityState).toEqual({ disabled: false }));

    fireEvent.press(submitButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Non-delivery', 'Goods never arrived', undefined));
  });
});
