import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { getDbExecutor, notifyDbChanged } from '@/db/client';
import { getRecipeById, saveRecipe } from '@/db/repositories/recipes';
import { deleteSetting, getSetting, setSetting } from '@/db/repositories/settings';
import { parseIngredientLines } from '@/domain/ingredient';
import { formatQuantity } from '@/domain/quantity';
import { generateId } from '@/lib/id';
import { useUiStore } from '@/stores/uiStore';
import type { RecipeDraft } from '@/types/recipe';
import { Button, Card, Screen, TextField } from '@/ui/components';
import { ErrorBoundaryFallback } from '@/ui/ErrorBoundaryFallback';
import { useTheme } from '@/ui/ThemeContext';
import { RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from '@/ui/tokens';

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return <ErrorBoundaryFallback {...props} />;
}

export default function RecipeEditScreen() {
  const { id, draftKey } = useLocalSearchParams<{ id?: string; draftKey?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const showToast = useUiStore((s) => s.showToast);

  const db = getDbExecutor();
  const storageDraftKey = draftKey ?? (id ? `draft_${id}` : 'draft_new');

  const initialData = useMemo(() => {
    if (draftKey) {
      const raw = getSetting(db, draftKey);
      if (raw) {
        try {
          return JSON.parse(raw) as RecipeDraft;
        } catch {
          // ignore
        }
      }
    }
    if (id) {
      const existing = getRecipeById(db, id);
      if (existing) {
        return {
          id: existing.id,
          title: existing.title,
          description: existing.description,
          servings: existing.servings,
          prepMinutes: existing.prepMinutes,
          cookMinutes: existing.cookMinutes,
          ingredientsText: existing.ingredients.map((i) => i.raw).join('\n'),
          stepsText: existing.steps.map((s) => s.text).join('\n'),
          notes: existing.notes,
          sourceUrl: existing.sourceUrl,
          sourceName: existing.sourceName,
          imagePath: existing.imagePath,
          thumbPath: existing.thumbPath,
          tags: existing.tags,
        } satisfies RecipeDraft;
      }
    }
    const savedDraft = getSetting(db, storageDraftKey);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft) as RecipeDraft;
      } catch {
        // ignore
      }
    }
    return null;
  }, [id, draftKey, storageDraftKey, db]);

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [servings, setServings] = useState(String(initialData?.servings ?? 4));
  const [prepMinutes, setPrepMinutes] = useState(
    initialData?.prepMinutes ? String(initialData.prepMinutes) : '',
  );
  const [cookMinutes, setCookMinutes] = useState(
    initialData?.cookMinutes ? String(initialData.cookMinutes) : '',
  );
  const [tagsText, setTagsText] = useState((initialData?.tags ?? []).join(', '));
  const [ingredientsText, setIngredientsText] = useState(initialData?.ingredientsText ?? '');
  const [stepsText, setStepsText] = useState(initialData?.stepsText ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [sourceUrl, setSourceUrl] = useState(initialData?.sourceUrl ?? '');
  const [imagePath, setImagePath] = useState<string | null>(initialData?.imagePath ?? null);
  const [thumbPath, setThumbPath] = useState<string | null>(initialData?.thumbPath ?? null);
  const [warnings] = useState<string[]>(initialData?.warnings ?? []);

  const parsedIngredients = useMemo(
    () => parseIngredientLines(ingredientsText),
    [ingredientsText],
  );

  // Autosave draft
  useEffect(() => {
    if (draftKey) return;
    const t = setTimeout(() => {
      const draft: RecipeDraft = {
        id,
        title,
        description: description || null,
        servings: Number(servings) || 4,
        prepMinutes: prepMinutes ? Number(prepMinutes) : null,
        cookMinutes: cookMinutes ? Number(cookMinutes) : null,
        ingredientsText,
        stepsText,
        notes: notes || null,
        sourceUrl: sourceUrl || null,
        sourceName: initialData?.sourceName ?? null,
        imagePath,
        thumbPath,
        tags: tagsText
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      };
      setSetting(db, storageDraftKey, JSON.stringify(draft));
    }, 400);
    return () => clearTimeout(t);
  }, [
    title,
    description,
    servings,
    prepMinutes,
    cookMinutes,
    tagsText,
    ingredientsText,
    stepsText,
    notes,
    sourceUrl,
    imagePath,
    thumbPath,
    id,
    draftKey,
    storageDraftKey,
    db,
    initialData?.sourceName,
  ]);

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const hero = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    const thumb = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 400 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    );

    const imagesDir = new Directory(Paths.document, 'recipe-images');
    if (!imagesDir.exists) {
      imagesDir.create({ intermediates: true, idempotent: true });
    }
    const fileStem = `${id ?? 'new'}-${generateId()}`;
    const heroDest = new File(imagesDir, `${fileStem}-hero.jpg`);
    const thumbDest = new File(imagesDir, `${fileStem}-thumb.jpg`);
    new File(hero.uri).copy(heroDest);
    new File(thumb.uri).copy(thumbDest);

    setImagePath(heroDest.uri);
    setThumbPath(thumbDest.uri);
  };

  const canSave = title.trim().length > 0 && parsedIngredients.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const steps = stepsText
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^\d+[.)]\s+/, ''))
      .filter(Boolean)
      .map((text) => ({ text }));

    const tags = Array.from(
      new Set(
        tagsText
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    const res = saveRecipe(
      db,
      {
        id,
        title: title.trim(),
        description: description.trim() || null,
        servings: Math.max(1, Number(servings) || 4),
        prepMinutes: prepMinutes ? Math.max(0, Math.round(Number(prepMinutes))) : null,
        cookMinutes: cookMinutes ? Math.max(0, Math.round(Number(cookMinutes))) : null,
        ingredients: parsedIngredients,
        steps,
        notes: notes.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        sourceName: initialData?.sourceName ?? null,
        imagePath,
        thumbPath,
        tags,
      },
      notifyDbChanged,
    );

    if (!res.ok) {
      showToast({ message: res.error.message });
      return;
    }

    deleteSetting(db, storageDraftKey);
    if (draftKey) deleteSetting(db, draftKey);
    showToast({ message: id ? 'Recipe updated.' : 'Recipe saved.' });
    router.replace(`/recipe/${res.value.id}`);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => {
            if (draftKey) deleteSetting(db, draftKey);
            router.back();
          }}
          style={styles.headerBtn}
        >
          <Text style={[TYPOGRAPHY.body, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>

        <Text style={[TYPOGRAPHY.subheading, { color: colors.text }]}>
          {draftKey ? 'Review import' : id ? 'Edit recipe' : 'New recipe'}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save recipe"
          disabled={!canSave}
          onPress={handleSave}
          style={styles.headerBtn}
        >
          <Text
            style={[
              TYPOGRAPHY.label,
              { color: canSave ? colors.primary : colors.textSecondary, opacity: canSave ? 1 : 0.45 },
            ]}
          >
            Save
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form}>
          {/* Import Review Banner */}
          {draftKey ? (
            <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
              <Text style={[TYPOGRAPHY.label, { color: colors.primary }]}>
                {sourceUrl
                  ? `Imported from ${sourceUrl.replace(/^https?:\/\//, '').split('/')[0]}. Check the details before saving.`
                  : 'Review the imported recipe before saving.'}
              </Text>
              {warnings.map((w, i) => (
                <Text key={i} style={[TYPOGRAPHY.caption, { color: colors.text, marginTop: 4 }]}>
                  • {w}
                </Text>
              ))}
            </Card>
          ) : null}

          {/* Cover Photo Picker (P1) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add cover photo"
            onPress={handlePickImage}
            style={[
              styles.photoBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {imagePath ? (
              <Image source={{ uri: imagePath }} style={styles.photoPreview} contentFit="cover" />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
                <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  Add cover photo (local only)
                </Text>
              </View>
            )}
          </Pressable>

          <TextField
            label="Title *"
            placeholder="e.g. Jollof rice"
            value={title}
            onChangeText={setTitle}
          />

          <TextField
            label="Description"
            placeholder="Short summary..."
            value={description}
            onChangeText={setDescription}
          />

          <View style={styles.threeCol}>
            <TextField
              label="Servings"
              keyboardType="numeric"
              value={servings}
              onChangeText={setServings}
              containerStyle={{ flex: 1 }}
            />
            <TextField
              label="Prep (min)"
              keyboardType="numeric"
              placeholder="15"
              value={prepMinutes}
              onChangeText={setPrepMinutes}
              containerStyle={{ flex: 1 }}
            />
            <TextField
              label="Cook (min)"
              keyboardType="numeric"
              placeholder="30"
              value={cookMinutes}
              onChangeText={setCookMinutes}
              containerStyle={{ flex: 1 }}
            />
          </View>

          <TextField
            label="Tags"
            placeholder="stew, dinner, quick"
            helper="Comma-separated"
            value={tagsText}
            onChangeText={setTagsText}
          />

          <TextField
            label="Ingredients * (one per line)"
            placeholder={'3 cups parboiled rice, washed\n2 tbsp tomato paste\nsalt to taste'}
            multiline
            value={ingredientsText}
            onChangeText={setIngredientsText}
            inputStyle={{ minHeight: 140 }}
          />

          {/* Live Parsed Pills Preview */}
          {parsedIngredients.length > 0 ? (
            <Card style={{ padding: SPACING.md }}>
              <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary, marginBottom: SPACING.sm }]}>
                Live parse preview ({parsedIngredients.length} lines)
              </Text>
              <View style={{ gap: 6 }}>
                {parsedIngredients.map((ing, idx) => (
                  <View key={idx} style={styles.pillRow}>
                    {ing.qty !== null ? (
                      <View style={[styles.pill, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[TYPOGRAPHY.caption, { color: colors.primary, fontWeight: '700' }]}>
                          {ing.qtyMax !== null
                            ? `${formatQuantity(ing.qty, null)}–${formatQuantity(ing.qtyMax, ing.unit)}`
                            : formatQuantity(ing.qty, ing.unit)}
                        </Text>
                      </View>
                    ) : null}
                    <View style={[styles.pill, { backgroundColor: colors.chipBg }]}>
                      <Text style={[TYPOGRAPHY.caption, { color: colors.text }]}>{ing.name}</Text>
                    </View>
                    {ing.note ? (
                      <View style={[styles.pill, { backgroundColor: colors.bg }]}>
                        <Text style={[TYPOGRAPHY.caption, { color: colors.textSecondary }]}>
                          {ing.note}
                        </Text>
                      </View>
                    ) : null}
                    {ing.warn ? (
                      <Ionicons name="warning-outline" size={16} color={colors.warning} />
                    ) : null}
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <TextField
            label="Steps (one per line)"
            placeholder={'Heat the oil and fry onions for 3 minutes.\nAdd tomato paste and simmer.'}
            multiline
            value={stepsText}
            onChangeText={setStepsText}
            inputStyle={{ minHeight: 150 }}
          />

          <TextField
            label="Notes"
            placeholder="Kitchen tips or variations..."
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <TextField
            label="Source link"
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
            value={sourceUrl}
            onChangeText={setSourceUrl}
          />

          <Button title="Save recipe" onPress={handleSave} disabled={!canSave} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minHeight: TOUCH_TARGET.min,
    minWidth: 56,
    justifyContent: 'center',
  },
  form: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: 60,
  },
  threeCol: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  photoBox: {
    height: 120,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
});
