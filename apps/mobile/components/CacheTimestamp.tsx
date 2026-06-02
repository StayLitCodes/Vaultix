import React from "react";
import { Text } from "react-native";

type Props = {
  timestamp?: number;
};

export default function CacheTimestamp({
  timestamp,
}: Props) {

  if (!timestamp) return null;

  const formatted =
    new Date(timestamp).toLocaleString();

  return (
    <Text className="text-xs text-neutral-500 mt-2">
      Last updated: {formatted}
    </Text>
  );
}