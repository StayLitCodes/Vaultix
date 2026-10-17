# Biometric lock recovery QA (#721)

## Scenario: lock enabled, hardware later unavailable

1. Enable biometric lock on a device with enrolled biometrics.
2. Simulate unavailability (iOS Simulator: Features → Face ID → Enrolled off; or physical device with biometrics removed).
3. Force-quit and reopen the app → lock screen should show the **unavailable** message (not a doomed biometric prompt loop).
4. Tap **Recover — Disable Lock**.
5. Confirm the app unlocks and Settings shows biometric lock off.
6. Verify wallet/session data is still present (recovery only clears the lock preference).

## Scenario: authenticateAsync always fails

1. With lock enabled and hardware present, fail biometrics repeatedly.
2. Use **Disable Biometric Lock** — OS passcode fallback should appear (`disableDeviceFallback: false`).
3. Cancel passcode → lock remains.
4. Complete passcode → lock disables.

## Release note

Permanent full-app lockout without reinstall is a release blocker if either recovery button fails when `hasHardwareAsync` / `isEnrolledAsync` is false.
