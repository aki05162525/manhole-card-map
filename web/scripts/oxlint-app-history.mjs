// Oxlint JS plugin (`.oxlintrc.json`): popstate is heard through
// `src/shared/browser/app-history.ts` alone. `no-restricted-globals` and
// `no-restricted-properties` cover `history`; this covers the event, which
// a name in a string reaches whatever object it is added on.
const message =
  "popstate の購読には src/shared/browser/app-history.ts の subscribe または onTraversal を使う。";
export default {
  meta: { name: "app-history" },
  rules: {
    "no-popstate": {
      create(context) {
        const check = (node, value) => {
          if (value === "popstate") context.report({ node, message });
        };
        return {
          Literal: (node) => check(node, node.value),
          TemplateElement: (node) => check(node, node.value.cooked),
        };
      },
    },
  },
};
