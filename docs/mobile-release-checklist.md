# Mobile QA Checklist & Release Pipeline

## Pre-release QA Checklist

### Functionality
- [ ] Login / wallet connect flow works end-to-end
- [ ] Create escrow wizard completes without errors
- [ ] Transaction history loads and displays correct statuses
- [ ] Raise dispute modal submits and shows confirmation
- [ ] Push notifications are received (iOS & Android)
- [ ] Offline banner appears when network is unavailable

### Accessibility
- [ ] All interactive elements have accessible labels
- [ ] Font scaling at 200% does not break layout
- [ ] VoiceOver (iOS) and TalkBack (Android) navigate correctly

### Performance
- [ ] App launches in under 3 seconds on a mid-range device
- [ ] No memory leaks observed after 10 minutes of usage

## Dev Build Pipeline

### Android (via EAS Build)
```bash
eas build --platform android --profile development
```

### iOS (via EAS Build)
```bash
eas build --platform ios --profile development
```

### Distribution
- Android: share `.apk` via EAS or Firebase App Distribution
- iOS: distribute via TestFlight using `--profile preview`

### Environment files
- `.env.development` — local backend URL
- `.env.staging` — staging backend URL

## Versioning
Bump `version` in `app.json` before each release.
Use semantic versioning: `MAJOR.MINOR.PATCH`.