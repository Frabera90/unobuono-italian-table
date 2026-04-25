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
