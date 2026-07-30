import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * 只管 src/ 下的源码。仓库根还放着三个发布产物 checkout（livo-*-demo、
 * html-demo）和 .attic，那些是构建出来的东西，扫它们没有意义。
 */
const eslintConfig = [
  {
    ignores: [
      ".attic/**",
      ".next/**",
      "out/**",
      "livo-pr-demo/**",
      "livo-world-demo/**",
      "html-demo/**",
      ".reference/**",
      // Next 自己生成的，跟着 .gitignore 一起当临时文件看。
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
