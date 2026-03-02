# Toast Notification System

A global toast notification system for user feedback throughout the application.

## Features

- ✅ Four notification types: success, error, warning, info
- ✅ Auto-dismiss with configurable duration (default: 5 seconds)
- ✅ Manual dismiss option
- ✅ Smooth animations (slide in/out)
- ✅ Accessible (ARIA labels, keyboard support)
- ✅ Stacked notifications
- ✅ Easy-to-use hook API

## Usage

### Basic Usage

```tsx
import { useToast } from "@/hooks/useToast";

function MyComponent() {
  const toast = useToast();

  const handleSuccess = () => {
    toast.success("Operation completed successfully!");
  };

  const handleError = () => {
    toast.error("Something went wrong!");
  };

  const handleWarning = () => {
    toast.warning("Please review your input.");
  };

  const handleInfo = () => {
    toast.info("New updates available.");
  };

  return <button onClick={handleSuccess}>Show Success Toast</button>;
}
```

### Custom Duration

```tsx
// Toast will stay for 10 seconds
toast.success("This message stays longer", 10000);

// Toast will not auto-dismiss (duration = 0)
toast.error("Manual dismiss only", 0);
```

### Manual Dismiss

```tsx
const toastId = toast.info("Processing...");

// Later, dismiss manually
toast.dismiss(toastId);
```

## API Reference

### `useToast()` Hook

Returns an object with the following methods:

- `success(message: string, duration?: number)` - Show success toast
- `error(message: string, duration?: number)` - Show error toast
- `warning(message: string, duration?: number)` - Show warning toast
- `info(message: string, duration?: number)` - Show info toast
- `dismiss(id: string)` - Manually dismiss a toast

### Parameters

- `message` (string, required): The message to display
- `duration` (number, optional): Duration in milliseconds before auto-dismiss. Default: 5000. Set to 0 to disable auto-dismiss.

## Integration

The toast system is already integrated into the app via `Providers.tsx`. No additional setup is required.

## Accessibility

- Uses ARIA live regions for screen reader announcements
- Keyboard accessible dismiss buttons
- Proper focus management
- Semantic HTML with appropriate roles

## Styling

Toast notifications are positioned at the top-right of the screen and stack vertically. Each toast type has distinct colors:

- Success: Green
- Error: Red
- Warning: Yellow
- Info: Blue

Animations are defined in `app/globals.css` and can be customized as needed.
