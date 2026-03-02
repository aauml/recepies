# 🍲 Thermomix® TM6 Recipe Collection

Personal vegetarian recipe collection optimized for the Thermomix® TM6. All recipes use accurate Thermomix settings (speed, temperature, time) and follow Cookidoo®-style formatting.

## Structure

```
index.html              ← Recipe index with search/filter
recipes/
  recipe-name.html      ← Individual recipe cards (self-contained)
```

## Adding a New Recipe

1. Generate the recipe HTML using the Claude Thermomix project
2. Save it as `recipes/recipe-name.html` (lowercase, hyphens)
3. Add an entry to the `recipes` array in `index.html`:

```js
{
  file: "recipes/recipe-name.html",
  title: "Recipe Title",
  description: "Short description.",
  time: "30 min",
  servings: "4",
  tags: ["main", "vegan"]
}
```

4. Commit and push

## Tags

`soup` · `main` · `side` · `dessert` · `bread` · `sauce` · `snack` · `breakfast` · `vegan` · `meal-prep`

## Hosting

Enable GitHub Pages (Settings → Pages → Source: main branch) to serve at:  
`https://aauml.github.io/recepies/`

---

*Thermomix® is a registered trademark of Vorwerk. This is a personal recipe collection.*
