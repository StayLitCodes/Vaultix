/**
 * Dashboard tab: escrow list + filters by status
 * Features: status filter tabs, infinite scroll/pagination, skeleton loaders, pull-refresh
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  } from 'react-native';
import { useRouter } from 'expo-router';
import { escrowApi } from '../../services/api';
import { Escrow, EscrowStatus } from '../../types/escrow';
import { OfflineBanner } from '../../components/OfflineBanner';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { toFriendlyError, isOfflineError } from '../../utils/errors';
