import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import { toggleRecipeFavorite } from '@/db/repositories/recipes';
import { getAllTags, searchRecipes } from '@/db/search';
import { formatMinutes } from '@/domain/duration';
import { useDbVersion } from '@/features/hooks';
import { useUiStore } from '@/stores/uiStore';
import type { RecipeListItem } from '@/types/recipe';
import { Button, Chip, EmptyState, Screen } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { getRecipeTileColor, RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

const RecipeCard = memo(function RecipeCard({
  item,
  onPress,
  onToggleFavorite,
}: {
  item: RecipeListItem;
  onPress: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const { colors } = useTheme();
  const tile = getRecipeTileColor(item.title);
  const totalMinutes = (item.prepMinutes ?? 0) + (item.cookMinutes ?? 0);
  const initial = item.title.trim().charAt(0).toUpperCase() || 'R';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, serves ${item.servings}`}
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {item.thumbPath ? (
        <Image
          source={{ uri: item.thumbPath }}
          style={styles.thumb}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.thumb, { backgroundColor: tile.bg }]}>
          <Text style={[TYPOGRAPHY.heading, { color: tile.fg, fontSize: 24 }]}>{initial}</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.metaRow}>
          {totalMinutes > 0 ? (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
                {formatMinutes(totalMinutes)}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginLeft: 4 }]}>
              Serves {item.servings}
            </Text>
          </View>
        </View>

        {item.matchedIngredients && item.matchedIngredients.length > 0 ? (
          <Text style={[TYPOGRAPHY.caption, { color: colors.primary, marginTop: 4 }]} numberOfLines={1}>
            matches: {item.matchedIngredients.join(', ')}
          </Text>
        ) : item.tags.length > 0 ? (
          <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={1}>
            {item.tags.slice(0, 3).map((t) => `#${t}`).join('  ')}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        accessibilityState={{ selected: item.isFavorite }}
        onPress={(e) => {
          e.stopPropagation();
          void Haptics.selectionAsync();
          onToggleFavorite(item.id);
        }}
        style={styles.favBtn}
      >
        <Ionicons
          name={item.isFavorite ? 'heart' : 'heart-outline'}
          size={22}
          color={item.isFavorite ? colors.danger : colors.textSecondary}
        />
      </Pressable>
    </Pressable>
  );
});

export default function LibraryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const dbVersion = useDbVersion();

  const searchText = useUiStore((s) => s.searchText);
  const setSearchText = useUiStore((s) => s.setSearchText);
  const favoriteOnly = useUiStore((s) => s.favoriteOnly);
  const toggleFavoriteOnly = useUiStore((s) => s.toggleFavoriteOnly);
  const under30Only = useUiStore((s) => s.under30Only);
  const toggleUnder30Only = useUiStore((s) => s.toggleUnder30Only);
  const selectedTag = useUiStore((s) => s.selectedTag);
  const setSelectedTag = useUiStore((s) => s.setSelectedTag);
  const clearFilters = useUiStore((s) => s.clearFilters);

  const [debouncedQuery, setDebouncedQuery] = useState(searchText);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchText);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchText]);

  const tags = useMemo(() => {
    try {
      return getAllTags(getDbExecutor());
    } catch {
      return [];
    }
  }, [dbVersion]);

  const recipes = useMemo(() => {
    try {
      return searchRecipes(getDbExecutor(), {
        query: debouncedQuery,
        favoriteOnly,
        under30Only,
        tag: selectedTag,
      });
    } catch {
      return [];
    }
  }, [dbVersion, debouncedQuery, favoriteOnly, under30Only, selectedTag]);

  const hasActiveFilter = Boolean(debouncedQuery.trim() || favoriteOnly || under30Only || selectedTag);

  const handleOpenRecipe = useCallback(
    (id: string) => {
      router.push(`/recipe/${id}`);
    },
    [router],
  );

  const handleToggleFavorite = useCallback((id: string) => {
    toggleRecipeFavorite(getDbExecutor(), id, notifyDbChanged);
  }, []);

  const navigateAdd = (path: '/recipe/edit' | '/import/link' | '/import/text' | '/import/backup') => {
    setAddSheetOpen(false);
    router.push(path);
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={[TYPOGRAPHY.title, { color: colors.text }]}>Ladleful</Text>
        <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
        </Text>
      </View>

      {/* Pinned Search Bar */}
      <View style={{ paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm }}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            accessibilityLabel="Search recipes, ingredients, tags"
            placeholder="Search recipes, ingredients..."
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            style={[TYPOGRAPHY.body, styles.searchInput, { color: colors.text }]}
          />
          {searchText.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearchText('')}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={{ marginBottom: SPACING.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Chip
            label="Favorites"
            active={favoriteOnly}
            onPress={toggleFavoriteOnly}
            icon={
              <Ionicons
                name={favoriteOnly ? 'heart' : 'heart-outline'}
                size={15}
                color={favoriteOnly ? colors.textOnPrimary : colors.text}
              />
            }
          />
          <Chip
            label="Under 30 min"
            active={under30Only}
            onPress={toggleUnder30Only}
            icon={
              <Ionicons
                name="flash-outline"
                size={15}
                color={under30Only ? colors.textOnPrimary : colors.text}
              />
            }
          />
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={`#${tag}`}
              active={selectedTag === tag}
              onPress={() => setSelectedTag(tag)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Recipe List */}
      {recipes.length === 0 ? (
        hasActiveFilter ? (
          <EmptyState
            icon={<Ionicons name="search-outline" size={28} color={colors.primary} />}
            title={`Nothing matches '${debouncedQuery || selectedTag || 'filters'}'.`}
            subtitle="Try clearing your search or filters."
          >
            <Button title="Clear filters" variant="secondary" onPress={clearFilters} />
          </EmptyState>
        ) : (
          <EmptyState
            icon={<Ionicons name="book-outline" size={28} color={colors.primary} />}
            title="Your recipe box is empty."
            subtitle="Write a recipe, import one from a link, or restore a backup file."
          >
            <Button title="Write a recipe" onPress={() => router.push('/recipe/edit')} />
            <Button
              title="Import from link"
              variant="secondary"
              onPress={() => router.push('/import/link')}
            />
            <Button
              title="Import a backup"
              variant="ghost"
              onPress={() => router.push('/import/backup')}
            />
          </EmptyState>
        )
      ) : (
        <FlashList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          renderItem={({ item }) => (
            <RecipeCard
              item={item}
              onPress={handleOpenRecipe}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        />
      )}

      {/* Floating Action Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add recipe"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setAddSheetOpen(true);
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.textOnPrimary} />
      </Pressable>

      {/* Add Menu Sheet */}
      <Modal
        visible={addSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddSheetOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddSheetOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[TYPOGRAPHY.heading, { color: colors.text, marginBottom: SPACING.md }]}>
              Add to recipe box
            </Text>

            <SheetOption
              icon="create-outline"
              title="Write a recipe"
              subtitle="Type ingredients one per line with live parsing"
              onPress={() => navigateAdd('/recipe/edit')}
            />
            <SheetOption
              icon="link-outline"
              title="Import from link"
              subtitle="Read structured recipe data from a web page"
              onPress={() => navigateAdd('/import/link')}
            />
            <SheetOption
              icon="clipboard-outline"
              title="Paste text"
              subtitle="Split a recipe copied from chat or notes"
              onPress={() => navigateAdd('/import/text')}
            />
            <SheetOption
              icon="archive-outline"
              title="Import backup file"
              subtitle="Restore from a Ladleful .json backup"
              onPress={() => navigateAdd('/import/backup')}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function SheetOption({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.sheetOption,
        {
          backgroundColor: pressed ? colors.chipBg : 'transparent',
        },
      ]}
    >
      <View style={[styles.sheetIconBox, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>{title}</Text>
        <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH_TARGET.min,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  clearBtn: {
    padding: SPACING.xs,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    marginLeft: SPACING.md,
    marginRight: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favBtn: {
    minWidth: TOUCH_TARGET.min,
    minHeight: TOUCH_TARGET.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderTopWidth: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    minHeight: TOUCH_TARGET.min,
  },
  sheetIconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
});
