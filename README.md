# Contacts Lister Template

HTML output template used by the [Contacts Lister for macOS and iOS](https://knvsoft.com/contactslister/).

Contacts Lister is a utility that enables you to generate HTML lists or QRcodes from your contact list.

## Files

- `styles/cl.css`: the whole list stylesheet. It declares its layers in this order: `reset`, `tokens`, `themes`, `base`, `components`, `options`, `refinements`, `print`. The themes are `[data-theme]` blocks in the `themes` layer.
- `styles/cl-apply-options.css`: the per-list options (layout, field and font choices). It is the `options` layer, so load it after `cl.css`.
- `index.html`: a sample list that loads both, in that order.
- `scripts/cl-main.js`: the sample's list script.

## Themes

Five themes, each named for what it is for and each a light and dark pair that follows the reader's Light/Dark setting
(`data-theme` on `<html>` and `<body>`):

| `data-theme` | Name | For |
|---|---|---|
| `clBlue` | Standard | Lister Blue on cool neutrals. The default. |
| `list` | List colour | The list's tag colour leads; the app sets `--list-hue`, `--list-accent-light` and `--list-accent-dark`. |
| `paper` | Paper | Warm cream, no pure white, ink-blue links: long reading, closest to print. |
| `contrast` | High contrast | Black and white, outlines instead of shadows, heavier type. |
| `calm` | Calm | Low glare both ways: no white in light, warm charcoal and an amber accent in dark. |

`data-appearance="light"` or `"dark"` forces one look for any theme; without it the system decides. Every pair keeps
text at 4.5:1 or more and control edges at 3:1 or more. The themes offered before (`auto`, `light`, `dark`, `dark-dim`,
`light-grape`, `dark-choco`) still open: Standard or Calm, keeping their light or dark.

## Contribution

Contacts Lister Template has its own contributing guidelines. Read [CONTRIBUTING.md](https://github.com/knvsoft/cl-template/blob/main/CONTRIBUTING.md) through before you create an issue or make a pull request.

## Acknowledgement

Following codes / libraries helped greatly in creating this app, thanks for their work.

### [Open Props](https://open-props.style/)

Open Props is a set of CSS custom properties (variables) that make it easy to create beautiful, consistent designs.

Thank you to Open Props for the original design of the output template and for the font stacks, which the template still uses by their names. Open Props is no longer used at run time: the template has no third-party CSS.

### [swift-html](https://github.com/pointfreeco/swift-html)

swift-html is a Swift library for generating HTML. It provides a type-safe way to create HTML documents and elements.

swift-html is used to generate most of the HTML for the app.

### [IDB-Keyval](https://github.com/jakearchibald/idb-keyval)

IDB-Keyval is a small library that provides a simple API for using IndexedDB.

IDB-Keyval is used to store the app's settings and data.