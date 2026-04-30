/**
 * 14 allergeni di legge (Reg. UE 1169/2011) + tag dietetici comuni.
 * Le chiavi sono stabili (vanno nel DB), le label si traducono in UI.
 */

export type AllergenKey =
  | "gluten" | "crustaceans" | "eggs" | "fish" | "peanuts" | "soy" | "milk"
  | "nuts" | "celery" | "mustard" | "sesame" | "sulphites" | "lupin" | "molluscs";

export const ALLERGENS: { key: AllergenKey; label: string; emoji: string }[] = [
  { key: "gluten", label: "Glutine", emoji: "🌾" },
  { key: "crustaceans", label: "Crostacei", emoji: "🦐" },
  { key: "eggs", label: "Uova", emoji: "🥚" },
  { key: "fish", label: "Pesce", emoji: "🐟" },
  { key: "peanuts", label: "Arachidi", emoji: "🥜" },
  { key: "soy", label: "Soia", emoji: "🌱" },
  { key: "milk", label: "Latte/Lattosio", emoji: "🥛" },
  { key: "nuts", label: "Frutta a guscio", emoji: "🌰" },
  { key: "celery", label: "Sedano", emoji: "🥬" },
  { key: "mustard", label: "Senape", emoji: "🌭" },
  { key: "sesame", label: "Sesamo", emoji: "✨" },
  { key: "sulphites", label: "Solfiti", emoji: "🍷" },
  { key: "lupin", label: "Lupini", emoji: "🫘" },
  { key: "molluscs", label: "Molluschi", emoji: "🦑" },
];

export type DietKey = "vegetarian" | "vegan" | "gluten_free" | "lactose_free" | "spicy";

export const DIETS: { key: DietKey; label: string; emoji: string }[] = [
  { key: "vegetarian", label: "Vegetariano", emoji: "🌿" },
  { key: "vegan", label: "Vegano", emoji: "🌱" },
  { key: "gluten_free", label: "Senza glutine", emoji: "🚫🌾" },
  { key: "lactose_free", label: "Senza lattosio", emoji: "🚫🥛" },
  { key: "spicy", label: "Piccante", emoji: "🌶️" },
];

export function allergenLabel(k: string): string {
  return ALLERGENS.find((a) => a.key === k)?.label || k;
}
export function dietLabel(k: string): string {
  return DIETS.find((d) => d.key === k)?.label || k;
}
export function allergenBadge(k: string): string {
  const a = ALLERGENS.find((x) => x.key === k);
  return a ? `${a.emoji} ${a.label}` : k;
}
export function dietBadge(k: string): string {
  const d = DIETS.find((x) => x.key === k);
  return d ? `${d.emoji} ${d.label}` : k;
}

/**
 * Riconcilia allergeni e diete per evitare combinazioni incoerenti.
 * Regole:
 * - vegan implica vegetarian → se vegan, vegetarian forzato
 * - vegan esclude allergeni animali (milk, eggs, fish, crustaceans, molluscs)
 * - vegetarian esclude allergeni di carne/pesce (fish, crustaceans, molluscs)
 * - lactose_free esclude milk
 * - gluten_free esclude gluten
 */
export function reconcileTags(
  allergens: AllergenKey[],
  diets: DietKey[],
  changed: { type: "allergen" | "diet"; key: string }
): { allergens: AllergenKey[]; diets: DietKey[]; warnings: string[] } {
  const A = new Set<AllergenKey>(allergens);
  const D = new Set<DietKey>(diets);
  const warnings: string[] = [];

  if (changed.type === "diet") {
    const k = changed.key as DietKey;
    if (k === "vegan") {
      if (D.has("vegan")) {
        D.add("vegetarian");
        const animals: AllergenKey[] = ["milk", "eggs", "fish", "crustaceans", "molluscs"];
        for (const a of animals) if (A.delete(a)) warnings.push(`Rimosso allergene "${allergenLabel(a)}" (incompatibile con vegano)`);
      }
    }
    if (k === "vegetarian" && !D.has("vegetarian")) {
      // Se rimuovo vegetariano, rimuovo anche vegano
      D.delete("vegan");
    }
    if (k === "lactose_free" && D.has("lactose_free")) {
      if (A.delete("milk")) warnings.push(`Rimosso allergene "Latte" (incompatibile con senza lattosio)`);
    }
    if (k === "gluten_free" && D.has("gluten_free")) {
      if (A.delete("gluten")) warnings.push(`Rimosso allergene "Glutine" (incompatibile con senza glutine)`);
    }
  } else {
    const k = changed.key as AllergenKey;
    if (A.has(k)) {
      if (k === "milk") {
        if (D.delete("lactose_free")) warnings.push(`Rimosso "Senza lattosio" (incompatibile con allergene Latte)`);
        if (D.delete("vegan")) warnings.push(`Rimosso "Vegano" (incompatibile con allergene Latte)`);
      }
      if (k === "eggs" && D.delete("vegan")) warnings.push(`Rimosso "Vegano" (incompatibile con allergene Uova)`);
      if ((k === "fish" || k === "crustaceans" || k === "molluscs")) {
        if (D.delete("vegan")) warnings.push(`Rimosso "Vegano"`);
        if (D.delete("vegetarian")) warnings.push(`Rimosso "Vegetariano"`);
      }
      if (k === "gluten" && D.delete("gluten_free")) warnings.push(`Rimosso "Senza glutine" (incompatibile con allergene Glutine)`);
    }
  }
  return { allergens: Array.from(A), diets: Array.from(D), warnings };
}
