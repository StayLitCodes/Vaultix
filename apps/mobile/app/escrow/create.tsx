/**
 * #316 – Mobile Create Escrow: multi-step form with contract constraint validation
 * Steps: 1) Parties  2) Milestones  3) Deadline  4) Review & Submit
 * Validates: milestone totals == total amount, 1-10 milestones, deadline in future
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { escrowApi } from '../../services/api';
import { toFriendlyError } from '../../utils/errors';
import { requireAuth } from '../../services/auth';
import * as StellarSdk from '@stellar/stellar-sdk';
import { getLocalWalletAddress } from '../../services/wallet';

const MAX_MILESTONES = 10;
const MIN_MILESTONES = 1;

interface MilestoneInput {
  title: string;
  amount: string;
  description: string;
}

interface FormState {
  counterpartyAddress: string;
  title: string;
  description: string;
  totalAmount: string;
  asset: string;
  deadline: string;
  milestones: MilestoneInput[];
}

const INITIAL_FORM: FormState = {
  counterpartyAddress: '',
  title: '',
  description: '',
  totalAmount: '',
  asset: 'XLM',
  deadline: '',
  milestones: [{ title: '', amount: '', description: '' }],
};

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.stepDot, i < current && styles.stepDotDone, i === current - 1 && styles.stepDotActive]} />
      ))}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, error }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean; error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti, !!error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#555"
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        autoCapitalize="none"
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export default function CreateEscrowScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    requireAuth(router, { pathname: '/escrow/create' });
  }, [router]);

  const update = (key: keyof FormState, value: FormState[keyof FormState]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateMilestone = (index: number, key: keyof MilestoneInput, value: string) => {
    const updated = form.milestones.map((m, i) => (i === index ? { ...m, [key]: value } : m));
    update('milestones', updated);
  };

  const addMilestone = () => {
    if (form.milestones.length >= MAX_MILESTONES) return;
    update('milestones', [...form.milestones, { title: '', amount: '', description: '' }]);
  };

  const removeMilestone = (index: number) => {
    if (form.milestones.length <= MIN_MILESTONES) return;
    update('milestones', form.milestones.filter((_, i) => i !== index));
  };

  const validateStep1 = async (): Promise<boolean> => {
    const e: Partial<Record<string, string>> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    const addr = form.counterpartyAddress.trim();
    if (!addr) {
      e.counterpartyAddress = 'Recipient address is required';
    } else if (!StellarSdk.StrKey.isValidEd25519PublicKey(addr)) {
      e.counterpartyAddress = 'Invalid Stellar address format';
    } else {
      const ownAddress = await getLocalWalletAddress();
      if (ownAddress && addr === ownAddress) {
        e.counterpartyAddress = 'You cannot escrow with yourself';
      }
    }
    const amountStr = form.totalAmount;
    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
      e.totalAmount = 'Enter a valid amount greater than 0';
    } else {
      const amount = Number(amountStr);
      const stroops = Math.round(amount * 10_000_000);
      if (stroops > Number.MAX_SAFE_INTEGER) {
        e.totalAmount = 'Amount is too large';
      } else if (amount !== stroops / 10_000_000) {
        e.totalAmount = 'Amount cannot have more than 7 decimal places';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    const total = Number(form.totalAmount);
    const milestoneSum = form.milestones.reduce((s, m) => s + Number(m.amount || 0), 0);

    if (form.milestones.length < MIN_MILESTONES || form.milestones.length > MAX_MILESTONES) {
      e.milestones = `Must have ${MIN_MILESTONES}–${MAX_MILESTONES} milestones`;
    }

    form.milestones.forEach((m, i) => {
      if (!m.title.trim()) e[`_title_${i}`] = 'Title required';
      if (!m.amount || isNaN(Number(m.amount)) || Number(m.amount) <= 0)
        e[`_amount_${i}`] = 'Valid amount required';
    });

    if (Math.abs(milestoneSum - total) > 0.0001)
      e.milestoneTotal = `Milestone amounts (${milestoneSum}) must equal total (${total})`;

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = (): boolean => {
    const e: Partial<Record<string, string>> = {};
    if (!form.deadline) { e.deadline = 'Deadline is required'; }
    else {
      const d = new Date(form.deadline);
      if (isNaN(d.getTime())) e.deadline = 'Invalid date';
      else if (d <= new Date()) e.deadline = 'Deadline must be in the future';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    let valid: boolean;
    if (step === 1) { valid = await validateStep1(); }
    else if (step === 2) { valid = validateStep2(); }
    else { valid = validateStep3(); }
    if (valid) setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const created = await escrowApi.create({
        title: form.title,
        description: form.description,
        counterpartyAddress: form.counterpartyAddress,
        amount: form.totalAmount,
        asset: form.asset,
        deadline: new Date(form.deadline).toISOString(),
        milestones: form.milestones.map((m) => ({
          title: m.title,
          amount: m.amount,
          description: m.description,
        })),
      });
      Alert.alert('Success', 'Escrow created!', [
        { text: 'View', onPress: () => router.replace({ pathname: '/escrow/[id]', params: { id: created.id } }) },
        { text: 'Dashboard', onPress: () => router.replace('/(tabs)/dashboard') },
      ]);
    } catch (err) {
      const friendly = toFriendlyError(err);
      Alert.alert(friendly.title, friendly.message, [{ text: 'OK' }]);
    } finally {
      setSubmitting(false);
    }
  };

  const milestoneSum = form.milestones.reduce((s, m) => s + Number(m.amount || 0), 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <StepIndicator current={step} total={4} />
        <Text style={styles.stepLabel}>Step {step} of 4</Text>

        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>Parties & Amount</Text>
            <Field label="Escrow Title" value={form.title} onChangeText={(v) => update('title', v)} placeholder="e.g. Website Development" error={errors.title} />
            <Field label="Description" value={form.description} onChangeText={(v) => update('description', v)} placeholder="Describe the agreement" multiline />
            <Field label="Recipient Wallet Address" value={form.counterpartyAddress} onChangeText={(v) => update('counterpartyAddress', v)} placeholder="G..." error={errors.counterpartyAddress} />
            <Field label="Total Amount (XLM)" value={form.totalAmount} onChangeText={(v) => update('totalAmount', v)} keyboardType="decimal-pad" placeholder="0.00" error={errors.totalAmount} />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>Milestones</Text>
            <Text style={styles.hint}>Total must equal {form.totalAmount || '0'} XLM. Current: {milestoneSum} XLM</Text>
            {errors.milestoneTotal && <Text style={styles.errorText}>{errors.milestoneTotal}</Text>}
            {errors.milestones && <Text style={styles.errorText}>{errors.milestones}</Text>}

            {form.milestones.map((m, i) => (
              <View key={i} style={styles.milestoneBlock}>
                <View style={styles.milestoneHeader}>
                  <Text style={styles.milestoneNum}>Milestone {i + 1}</Text>
                  {form.milestones.length > MIN_MILESTONES && (
                    <TouchableOpacity onPress={() => removeMilestone(i)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Field label="Title" value={m.title} onChangeText={(v) => updateMilestone(i, 'title', v)} placeholder="Milestone title" error={errors[`_title_${i}`]} />
                <Field label="Amount (XLM)" value={m.amount} onChangeText={(v) => updateMilestone(i, 'amount', v)} keyboardType="decimal-pad" placeholder="0.00" error={errors[`_amount_${i}`]} />
              </View>
            ))}

            {form.milestones.length < MAX_MILESTONES && (
              <TouchableOpacity style={styles.addBtn} onPress={addMilestone}>
                <Text style={styles.addBtnText}>+ Add Milestone</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Deadline</Text>
            <Field
              label="Deadline (YYYY-MM-DD)"
              value={form.deadline}
              onChangeText={(v) => update('deadline', v)}
              placeholder="2026-12-31"
              error={errors.deadline}
            />
            <Text style={styles.hint}>The escrow will expire if not completed by this date.</Text>
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>Review & Submit</Text>
            <View style={styles.reviewCard}>
              <ReviewRow label="Title" value={form.title} />
              <ReviewRow label="Recipient" value={form.counterpartyAddress} />
              <ReviewRow label="Amount" value={`${form.totalAmount} ${form.asset}`} />
              <ReviewRow label="Deadline" value={form.deadline} />
              <ReviewRow label="Milestones" value={`${form.milestones.length} milestone(s)`} />
            </View>
            <Text style={styles.hint}>By submitting, you agree to lock funds until milestones are released.</Text>
          </View>
        )}

        <View style={styles.navRow}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          )}
          {step < 4 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, submitting && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Create Escrow</Text>}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121f' },
  content: { padding: 16, paddingBottom: 40 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2d2d44' },
  stepDotDone: { backgroundColor: '#6c63ff' },
  stepDotActive: { backgroundColor: '#6c63ff', transform: [{ scale: 1.3 }] },
  stepLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  stepTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  hint: { color: '#888', fontSize: 12, marginBottom: 8 },
  field: { marginBottom: 16 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#1e1e30', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderWidth: 1, borderColor: '#ef476f' },
  errorText: { color: '#ef476f', fontSize: 12, marginTop: 4 },
  milestoneBlock: { backgroundColor: '#1a1a1e', borderRadius: 12, padding: 16, marginBottom: 12 },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  milestoneNum: { color: '#fff', fontWeight: '600' },
  removeText: { color: '#ef476f', fontSize: 13 },
  addBtn: { borderWidth: 1, borderColor: '#6c63ff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: '#6c63ff', fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  backBtn: { backgroundColor: '#2d2d44', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  nextBtn: { backgroundColor: '#6c63ff', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  reviewCard: { backgroundColor: '#1e1e30', borderRadius: 12, padding: 12, marginBottom: 16 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2d2d44' },
  reviewLabel: { color: '#888', fontSize: 13 },
  reviewValue: { color: '#fff', fontSize: 13, fontWeight: '500', maxWidth: '60%' },
});

