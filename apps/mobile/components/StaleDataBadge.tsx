import React from "react";
import { View, Text } from "react-native";

type Props = {
  stale: boolean;
};

export default function StaleDataBadge({
  stale,
}: Props) {

  if (!stale) return null;

  return (
    <View className="bg-orange-500 px-2 py-1 rounded-full self-start">
      <Text className="text-white text-xs font-semibold">
        Stale Data
      </Text>
    </View>
  );
}