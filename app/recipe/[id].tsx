import React, { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import {
  getRecipeById,
  markRecipeCooked,
  restoreRecipe,
  softDeleteRecipe,
  toggleRecipeFavorite,
} from '@/db/repositories/recipes';
import {
  addRecipesToShoppingList,
  createShoppingList,
  getShoppingLists,
} from '@/db/repositories/shopping';
import { formatMinutes } from '@/domain/duration';
import { formatQuantity } from '@/domain/quantity';
import { scaleIngredients } from '@/domain/scale';
import { formatRecipeMarkdown } from '@/export/markdown';
import { formatRecipeShareText } from '@/export/shareText';
import { useDbVersion } from '@/features/hooks';
import { isSafeHttpUrl } from '@/lib/html';
import { useUiStore } from '@/stores/uiStore';
import { Button, Card, Chip, EmptyState, Screen } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { TimerBar } from '@/ui/TimerBar';
import { getRecipeTileColor, RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const dbVersion = useDbVersion();
  const showToast = useUiStore((s) => s.showToast);

  const recipe = useMemo(() => {
    if (!id) return null;
    return getRecipeById(getDbExecutor(), id);
  }, [id, dbVersion]);

  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [checkedIngs, setCheckedIngs] = useState<Set<number>>(new Set());
  const [listModalOpen, setListModalOpen] = useState(false);
  const [moreModalOpen, setMoreModalOpen] = useState(false);

  const activeServings = targetServings ?? recipe?.servings ?? 4;
  const isScaled = recipe ? activeServings !== recipe.servings : false;

  const scaledIngredients = useMemo(() => {
    if (!recipe) return [];
    return scaleIngredients(recipe.ingredients, recipe.servings, activeServings);
  }, [recipe, activeServings]);

  const shoppingLists = useMemo(() => {
    if (!listModalOpen) return [];
    return getShoppingLists(getDbExecutor());
  }, [listModalOpen, dbVersion]);

  if (!recipe) {
    return (
      <Screen>
        <EmptyState
          icon={<Ionicons name="book-outline" size={28} color={colors.primary} />}
          title="Recipe not found"
          subtitle="It may have been removed."
        >
          <Button title="Back to library" onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  const tile = getRecipeTileColor(recipe.title);
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  const toggleIngredientCheck = (index: number) => {
    void Haptics.selectionAsync();
    setCheckedIngs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleShareText = async () => {
    const text = formatRecipeShareText(
      { ...recipe, ingredients: scaledIngredients },
      activeServings,
    );
    await Share.share({ message: text, title: recipe.title });
  };

  const handleShareMarkdown = async () => {
    setMoreModalOpen(false);
    const md = formatRecipeMarkdown(recipe);
    const safeName = recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'recipe';
    const file = new FileSystem.File(FileSystem.Paths.cache, `${safeName}.md`);
    file.write(md);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: recipe.title });
    } else {
      await Share.share({ message: md, title: recipe.title });
    }
  };

  const handleAddToList = (listId: string) => {
    const db = getDbExecutor();
    const res = addRecipesToShoppingList(
      db,
      listId,
      scaledIngredients.map((ing) => ({
        ingredient: ing,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
      })),
      notifyDbChanged,
    );
    setListModalOpen(false);
    showToast({
      message: `Added ${res.addedCount} items, combined ${res.combinedCount}`,
      actionLabel: 'View',
      onAction: () => router.push(`/shopping/${listId}`),
    });
  };

  const handleCreateAndAdd = () => {
    const db = getDbExecutor();
    const list = createShoppingList(db, recipe.title, notifyDbChanged);
    handleAddToList(list.id);
  };

  const handleDelete = () => {
    setMoreModalOpen(false);
    const snapshot = recipe;
    softDeleteRecipe(getDbExecutor(), recipe.id, notifyDbChanged);
    showToast({
      message: 'Recipe removed.',
      actionLabel: 'Undo',
      onAction: () => {
        restoreRecipe(getDbExecutor(), snapshot, notifyDbChanged);
      },
    });
    router.back();
  };

  return (
    <Screen edges={['top']}>
      {/* Top Nav Bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recipe.isFavorite ? 'Remove favorite' : 'Favorite'}
            onPress={() => {
              void Haptics.selectionAsync();
              toggleRecipeFavorite(getDbExecutor(), recipe.id, notifyDbChanged);
            }}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons
              name={recipe.isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={recipe.isFavorite ? colors.danger : colors.text}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share recipe"
            onPress={handleShareText}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="share-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            onPress={() => setMoreModalOpen(true)}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 110 }}>
        {/* Hero */}
        {recipe.imagePath ? (
          <Image source={{ uri: recipe.imagePath }} style={styles.heroImg} contentFit="cover" />
        ) : (
          <View style={[styles.heroBanner, { backgroundColor: tile.bg }]}>
            <Ionicons name="restaurant-outline" size={32} color={tile.fg} style={{ opacity: 0.9 }} />
          </View>
        )}

        <Text style={[TYPOGRAPHY.title, { color: colors.text, marginTop: SPACING.lg }]}>
          {recipe.title}
        </Text>

        {recipe.description ? (
          <Text style={[TYPOGRAPHY.body, { color: colors.textSecondary, marginTop: SPACING.xs }]}>
            {recipe.description}
          </Text>
        ) : null}

        {/* Meta Pills */}
        <View style={styles.metaWrap}>
          {recipe.prepMinutes ? (
            <Chip label={`Prep ${formatMinutes(recipe.prepMinutes)}`} />
          ) : null}
          {recipe.cookMinutes ? (
            <Chip label={`Cook ${formatMinutes(recipe.cookMinutes)}`} />
          ) : null}
          {totalMinutes > 0 ? <Chip label={`Total ${formatMinutes(totalMinutes)}`} /> : null}
          {recipe.timesCooked > 0 ? <Chip label={`Cooked ${recipe.timesCooked}×`} /> : null}
          {recipe.tags.map((t) => (
            <Chip key={t} label={`#${t}`} />
          ))}
        </View>

        {/* Source attribution */}
        {recipe.sourceUrl || recipe.sourceName ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              if (recipe.sourceUrl && isSafeHttpUrl(recipe.sourceUrl)) {
                void Linking.openURL(recipe.sourceUrl);
              }
            }}
            style={{ marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="link-outline" size={15} color={colors.primary} />
            <Text style={[TYPOGRAPHY.caption, { color: colors.primary, marginLeft: 4 }]}>
              {recipe.sourceName ?? recipe.sourceUrl}
            </Text>
          </Pressable>
        ) : null}

        {/* Active Timers for this recipe */}
        <View style={{ marginTop: SPACING.md }}>
          <TimerBar recipeId={recipe.id} />
        </View>

        {/* Primary CTA Row */}
        <View style={styles.ctaRow}>
          <Button
            title="Cook mode"
            icon={<Ionicons name="flame-outline" size={18} color={colors.textOnPrimary} />}
            onPress={() => router.push(`/recipe/cook?id=${recipe.id}&servings=${activeServings}`)}
            style={{ flex: 1 }}
          />
          <Button
            title="Add to list"
            variant="secondary"
            icon={<Ionicons name="cart-outline" size={18} color={colors.text} />}
            onPress={() => setListModalOpen(true)}
            style={{ flex: 1 }}
          />
        </View>

        {/* Servings Stepper Card */}
        <Card style={{ marginTop: SPACING.lg }}>
          <View style={styles.stepperRow}>
            <View style={{ flex: 1 }}>
              <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>Servings</Text>
              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
                {isScaled
                  ? `Scaled for ${activeServings}, originally ${recipe.servings}`
                  : `Original yield: ${recipe.servings}`}
              </Text>
            </View>

            <View style={styles.stepperControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease servings"
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTargetServings(Math.max(1, activeServings - 1));
                }}
                style={[styles.stepBtn, { backgroundColor: colors.chipBg, borderColor: colors.border }]}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </Pressable>

              <Text
                style={[
                  TYPOGRAPHY.heading,
                  {
                    color: colors.text,
                    minWidth: 36,
                    textAlign: 'center',
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {activeServings}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase servings"
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTargetServings(activeServings + 1);
                }}
                style={[styles.stepBtn, { backgroundColor: colors.chipBg, borderColor: colors.border }]}
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {isScaled ? (
            <View style={styles.scaleNotice}>
              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, flex: 1 }]}>
                {"Amounts inside steps aren't scaled."}
              </Text>
              <Pressable onPress={() => setTargetServings(null)}>
                <Text style={[TYPOGRAPHY.label, { color: colors.primary, fontSize: 13 }]}>Reset</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {/* Ingredients */}
        <Text style={[TYPOGRAPHY.heading, { color: colors.text, marginTop: SPACING.xl, marginBottom: SPACING.sm }]}>
          Ingredients
        </Text>
        <Card>
          {scaledIngredients.map((ing, idx) => {
            const prevGroup = idx > 0 ? scaledIngredients[idx - 1]?.group : null;
            const showGroup = ing.group && ing.group !== prevGroup;
            const checked = checkedIngs.has(idx);
            const qtyText =
              ing.qtyMax !== null && ing.qty !== null
                ? `${formatQuantity(ing.qty, null)}–${formatQuantity(ing.qtyMax, ing.unit)}`
                : formatQuantity(ing.qty, ing.unit);

            return (
              <View key={`${idx}-${ing.raw}`}>
                {showGroup ? (
                  <Text
                    style={[
                      TYPOGRAPHY.label,
                      {
                        color: colors.primary,
                        marginTop: idx === 0 ? 0 : SPACING.md,
                        marginBottom: SPACING.xs,
                      },
                    ]}
                  >
                    {ing.group}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => toggleIngredientCheck(idx)}
                  style={[
                    styles.ingRow,
                    idx < scaledIngredients.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={checked ? colors.primary : colors.textSecondary}
                    style={{ marginRight: SPACING.md }}
                  />
                  <Text
                    style={[
                      TYPOGRAPHY.body,
                      {
                        flex: 1,
                        color: checked ? colors.textSecondary : colors.text,
                        textDecorationLine: checked ? 'line-through' : 'none',
                        opacity: checked ? 0.65 : 1,
                      },
                    ]}
                  >
                    {qtyText ? <Text style={{ fontWeight: '700' }}>{qtyText} </Text> : null}
                    {ing.name}
                    {ing.note ? (
                      <Text style={{ color: colors.textSecondary }}>, {ing.note}</Text>
                    ) : null}
                  </Text>
                  {ing.warn ? (
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={colors.warning}
                      style={{ marginLeft: SPACING.xs }}
                    />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </Card>

        {/* Steps */}
        <Text style={[TYPOGRAPHY.heading, { color: colors.text, marginTop: SPACING.xl, marginBottom: SPACING.sm }]}>
          Steps
        </Text>
        <View style={{ gap: SPACING.md }}>
          {recipe.steps.map((step, idx) => (
            <Card key={idx}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={[styles.stepNum, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[TYPOGRAPHY.label, { color: colors.primary }]}>{idx + 1}</Text>
                </View>
                <Text style={[TYPOGRAPHY.body, { color: colors.text, flex: 1 }]}>{step.text}</Text>
              </View>
            </Card>
          ))}
        </View>

        {/* Notes */}
        {recipe.notes ? (
          <>
            <Text style={[TYPOGRAPHY.heading, { color: colors.text, marginTop: SPACING.xl, marginBottom: SPACING.sm }]}>
              Notes
            </Text>
            <Card>
              <Text style={[TYPOGRAPHY.body, { color: colors.textSecondary }]}>{recipe.notes}</Text>
            </Card>
          </>
        ) : null}
      </ScrollView>

      {/* Add to Shopping List Modal */}
      <Modal
        visible={listModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setListModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setListModalOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[TYPOGRAPHY.heading, { color: colors.text, marginBottom: SPACING.md }]}>
              Add ingredients to list
            </Text>
            {shoppingLists.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => handleAddToList(l.id)}
                style={[styles.modalRow, { borderBottomColor: colors.border }]}
              >
                <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>{l.name}</Text>
                <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
                  {l.uncheckedCount ?? 0} left
                </Text>
              </Pressable>
            ))}
            <Button
              title={`New list: "${recipe.title}"`}
              onPress={handleCreateAndAdd}
              style={{ marginTop: SPACING.md }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* More Options Modal */}
      <Modal
        visible={moreModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMoreModalOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Button
              title="Edit recipe"
              variant="secondary"
              onPress={() => {
                setMoreModalOpen(false);
                router.push(`/recipe/edit?id=${recipe.id}`);
              }}
              style={{ marginBottom: SPACING.sm }}
            />
            <Button
              title="Mark cooked (+1)"
              variant="secondary"
              onPress={() => {
                setMoreModalOpen(false);
                markRecipeCooked(getDbExecutor(), recipe.id, notifyDbChanged);
                showToast({ message: 'Logged! Cooked count updated.' });
              }}
              style={{ marginBottom: SPACING.sm }}
            />
            <Button
              title="Export as Markdown"
              variant="secondary"
              onPress={handleShareMarkdown}
              style={{ marginBottom: SPACING.sm }}
            />
            <Button title="Delete recipe" variant="danger" onPress={handleDelete} />
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
    justifyContent: 'space-between',
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
  heroImg: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },
  heroBanner: {
    width: '100%',
    height: 110,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    minHeight: TOUCH_TARGET.min,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
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
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
