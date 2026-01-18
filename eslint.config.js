 import eslint from "@eslint/js";
 import tseslint from "typescript-eslint";
 
 export default tseslint.config(
   eslint.configs.recommended,
   ...tseslint.configs.recommended,
   {
     ignores: ["dist/**"],
   },
   {
     languageOptions: {
       ecmaVersion: 2022,
       sourceType: "module",
     },
   }
 );
