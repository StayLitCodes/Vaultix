/**
 * Tailwind-style `className` props are used by some components. Until a
 * styling runtime (e.g. NativeWind) is wired up, declare the prop so
 * TypeScript accepts it on core React Native components.
 */
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
}
