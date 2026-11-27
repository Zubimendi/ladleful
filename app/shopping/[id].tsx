import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AISLE_LABELS, AISLE_ORDER } from '@/data/aisles';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import { getRecipeById } from '@/db/repositories/recipes';
import { getPantryStaples } from '@/db/repositories/settings';
import {
  addManualShoppingItem,
  addRecipesToShoppingList,
  clearCheckedShoppingItems,
  getShoppingItems,
  getShoppingListById,
  toggleShoppingItemChecked,
} from '@/db/repositories/shopping';
import { searchRecipes } from '@/db/search';
import { formatQuantity } from '@/domain/quantity';
import { scaleIngredients } from '@/domain/scale';
import { formatShoppingListShareText } from '@/export/shareText';
import { useDbVersion } from '@/features/hooks';
import { useUiStore } from '@/stores/uiStore';
import type { Aisle, ShoppingItem } from '@/types/shopping';
import { Button, Card, Chip, EmptyState, Screen } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function ShoppingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const dbVersion = useDbVersion();
  const showToast = useUiStore((s) => s.showToast);

  const db = getDbExecutor();
  const list = useMemo(() => (id ? getShoppingListById(db, id) : null), [id, dbVersion, db]);
  const items = useMemo(() => (id ? getShoppingItems(db, id) : []), [id, dbVersion, db]);
  const pantryStaples = useMemo(() => getPantryStaples(db), [dbVersion, db]);

  const [quickAdd, setQuickAdd] = useState('');
  const [collapsedAisles, setCollapsedAisles] = useState<Set<Aisle>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<Map<string, number>>(new Map());

  const allRecipes = useMemo(() => {
    if (!pickerOpen) return [];
    return searchRecipes(db, { query: '' });
  }, [pickerOpen, dbVersion, db]);

  const groupedByAisle = useMemo(() => {
    const map = new Map<Aisle, ShoppingItem[]>();
    for (const item of items) {
      const arr = map.get(item.aisle) ?? [];
      arr.push(item);
      map.set(item.aisle, arr);
    }
    return AISLE_ORDER.filter((a) => (map.get(a)?.length ?? 0) > 0).map((aisle) => ({
      aisle,
      label: AISLE_LABELS[aisle],
      items: map.get(aisle)!,
    }));
  }, [items]);

  if (!list) {
    return (
      <Screen>
        <EmptyState title="List not found">
          <Button title="Back" onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  const handleQuickAdd = () => {
    if (!quickAdd.trim()) return;
    addManualShoppingItem(db, list.id, quickAdd.trim(), notifyDbChanged);
    setQuickAdd('');
  };

  const handleShare = async () => {
    const text = formatShoppingListShareText(list, items);
    await Share.share({ message: text, title: list.name });
  };

  const handleAddSelectedRecipes = () => {
    const lines = [];
    for (const [recipeId, targetServings] of selectedRecipes.entries()) {
      const recipe = getRecipeById(db, recipeId);
      if (!recipe) continue;
      const scaled = scaleIngredients(recipe.ingredients, recipe.servings, targetServings);
      for (const ing of scaled) {
        lines.push({ ingredient: ing, recipeId: recipe.id, recipeTitle: recipe.title });
      }
    }
    const res = addRecipesToShoppingList(db, list.id, lines, notifyDbChanged);
    setPickerOpen(false);
    setSelectedRecipes(new Map());
    showToast({
      message: `Added ${res.addedCount} items, combined ${res.combinedCount}${
        res.skippedCount > 0 ? `, skipped ${res.skippedCount} pantry` : ''
      }`,
    });
  };

  const toggleAisle = (aisle: Aisle) => {
    setCollapsedAisles((prev) => {
      const next = new Set(prev);
      if (next.has(aisle)) next.delete(aisle);
      else next.add(aisle);
      return next;
    });
  };

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <Text style={[TYPOGRAPHY.heading, { color: colors.text, flex: 1, marginLeft: SPACING.md }]} numberOfLines={1}>
          {list.name}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share list"
          onPress={handleShare}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="share-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Action Chips */}
      <View style={styles.actionsRow}>
        <Chip
          label="Add from recipes"
          active
          onPress={() => setPickerOpen(true)}
          icon={<Ionicons name="book-outline" size={15} color={colors.textOnPrimary} />}
        />
        {checkedCount > 0 ? (
          <Chip
            label={`Clear checked (${checkedCount})`}
            onPress={() => clearCheckedShoppingItems(db, list.id, notifyDbChanged)}
          />
        ) : null}
        <Chip
          label={`Skipping ${pantryStaples.length} pantry`}
          onPress={() => router.push('/settings/pantry')}
        />
      </View>

      {/* Items by Aisle */}
      {items.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="cart-outline" size={28} color={colors.primary} />}
          title="List is empty"
          subtitle="Add recipes to build your list, or type an item below."
        >
          <Button title="Add from recipes" onPress={() => setPickerOpen(true)} />
        </EmptyState>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 100 }}>
          {groupedByAisle.map((section) => {
            const collapsed = collapsedAisles.has(section.aisle);
            return (
              <View key={section.aisle} style={{ marginTop: SPACING.md }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggleAisle(section.aisle)}
                  style={styles.aisleHeader}
                >
                  <Text style={[TYPOGRAPHY.label, { color: colors.primary }]}>
                    {section.label} ({section.items.length})
                  </Text>
                  <Ionicons
                    name={collapsed ? 'chevron-forward' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {!collapsed ? (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    {section.items.map((item, idx) => {
                      const qtyText = formatQuantity(item.quantity, item.unit);
                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: item.checked }}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            toggleShoppingItemChecked(db, item.id, notifyDbChanged);
                          }}
                          style={[
                            styles.itemRow,
                            idx < section.items.length - 1 && {
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={item.checked ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={item.checked ? colors.primary : colors.textSecondary}
                            style={{ marginRight: SPACING.md }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                TYPOGRAPHY.body,
                                {
                                  color: item.checked ? colors.textSecondary : colors.text,
                                  textDecorationLine: item.checked ? 'line-through' : 'none',
                                  opacity: item.checked ? 0.65 : 1,
                                },
                              ]}
                            >
                              {qtyText ? <Text style={{ fontWeight: '700' }}>{qtyText} </Text> : null}
                              {item.name}
                            </Text>
                            {item.sources.length > 0 ? (
                              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
                                from {item.sources.length}{' '}
                                {item.sources.length === 1 ? 'recipe' : 'recipes'}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </Card>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Quick Add Bar */}
      <View
        style={[
          styles.quickAddBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <TextInput
          placeholder="Add an item..."
          placeholderTextColor={colors.textSecondary}
          value={quickAdd}
          onChangeText={setQuickAdd}
          onSubmitEditing={handleQuickAdd}
          returnKeyType="done"
          style={[
            TYPOGRAPHY.body,
            styles.quickInput,
            { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add item"
          onPress={handleQuickAdd}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={24} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      {/* Recipe Picker Modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[TYPOGRAPHY.heading, { color: colors.text, marginBottom: SPACING.md }]}>
              Pick recipes to merge
            </Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {allRecipes.map((r) => {
                const chosenServings = selectedRecipes.get(r.id);
                const selected = chosenServings !== undefined;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      setSelectedRecipes((prev) => {
                        const next = new Map(prev);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.set(r.id, r.servings);
                        return next;
                      });
                    }}
                    style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? colors.primary : colors.textSecondary}
                      style={{ marginRight: SPACING.md }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>{r.title}</Text>
                      <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
                        Serves {chosenServings ?? r.servings}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button
              title={`Merge ${selectedRecipes.size} ${selectedRecipes.size === 1 ? 'recipe' : 'recipes'}`}
              disabled={selectedRecipes.size === 0}
              onPress={handleAddSelectedRecipes}
              style={{ marginTop: SPACING.md }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  iconBtn: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  aisleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs + 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: TOUCH_TARGET.min,
  },
  quickAddBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  quickInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGET.min,
  },
  addBtn: {
    width: TOUCH_TARGET.min,
    height: TOUCH_TARGET.min,
    borderRadius: RADIUS.md,
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
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
