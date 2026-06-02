import NetInfo from
  "@react-native-community/netinfo";

export async function isOnline() {
  const state = await NetInfo.fetch();

  return Boolean(
    state.isConnected &&
    state.isInternetReachable
  );
}