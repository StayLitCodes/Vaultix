import React from "react";
import { View, Text } from "react-native";

type Props = {
  message: string;
  error?: boolean;
};

export default function ScanResultBanner({
  message,
  error = false,
}: Props) {
  return (
    <View
      className={`
        px-4 py-3 rounded-xl mt-3
        ${error ? "bg-red-500" : "bg-green-600"}
      `}
    >
      <Text className="text-white text-sm font-medium">
        {message}
      </Text>
    </View>
  );
}