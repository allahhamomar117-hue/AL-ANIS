import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      /*
       * الشرطة السفلية إعلانٌ صريح أن الوسيط مُهمَل عمداً — وهو عُرف قائم
       * في المشروع (_req و_res و_next).
       *
       * القاعدة الافتراضية (args: "after-used") لا تشكو إلا من الأخير، وهو
       * ما كان يوقع معالج أخطاء Express: توقيعه يجب أن يعلن أربعة وسائط
       * ليعرفه إطار العمل معالجَ أخطاء، فلو حُذف `_next` إرضاءً للمُدقّق
       * لعُومل الدالةُ وسيطاً عادياً ولم تصل إليها الأخطاء أصلاً.
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
])
