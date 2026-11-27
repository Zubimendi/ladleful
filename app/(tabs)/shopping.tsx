import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import {
  archiveShoppingList,
  createShoppingList,
  getShoppingLists,
} from '@/db/repositories/shopping';
import { useDbVersion } from '@/features/hooks';
import { Button, EmptyState, Screen, TextField } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function ShoppingListsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const dbVersion = useDbVersion();

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const lists = useMemo(() => {
    try {
      return getShoppingLists(getDbExecutor());
    } catch {
      return [];
    }
  }, [dbVersion]);

  const handleCreate = () => {
    const db = getDbExecutor();
    const list = createShoppingList(db, newName.trim() || 'Weekly groceries', notifyDbChanged);
    setNewName('');
    setNewModalOpen(false);
    router.push(`/shopping/${list.id}`);
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.title, { color: colors.text }]}>Shopping</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New shopping list"
          onPress={() => setNewModalOpen(true)}
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={20} color={colors.textOnPrimary} />
          <Text style={[TYPOGRAPHY.label, { color: colors.textOnPrimary, marginLeft: 4 }]}>
            New list
          </Text>
        </Pressable>
      </View>

      {lists.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="cart-outline" size={28} color={colors.primary} />}
          title="No shopping lists yet."
          subtitle="Create a list and add recipes to merge quantities and group by aisle."
        >
          <Button title="Create shopping list" onPress={() => setNewModalOpen(true)} />
        </EmptyState>
      ) : (
        <FlashList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.uncheckedCount ?? 0} items left`}
              onPress={() => router.push(`/shopping/${item.id}`)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="basket-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>{item.name}</Text>
                <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {item.uncheckedCount ?? 0} left · {item.itemCount ?? 0} total
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Archive list"
                onPress={(e) => {
                  e.stopPropagation();
                  archiveShoppingList(getDbExecutor(), item.id, true, notifyDbChanged);
                }}
                style={{ padding: SPACING.sm }}
              >
                <Ionicons name="archive-outline" size={20} color={colors.textSecondary} />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      <Modal
        visible={newModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNewModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setNewModalOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[TYPOGRAPHY.heading, { color: colors.text, marginBottom: SPACING.md }]}>
              New shopping list
            </Text>
            <TextField
              label="List name"
              placeholder="e.g. Weekend market"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <Button title="Create list" onPress={handleCreate} style={{ marginTop: SPACING.lg }} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    minHeight: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: TOUCH_TARGET.min,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
});
