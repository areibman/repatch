import { WebpackOverrideFn } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind-v4";
import path from "path";

export const webpackOverride: WebpackOverrideFn = (currentConfiguration) =>
  enableTailwind({
    ...currentConfiguration,

    resolve: {
      ...currentConfiguration.resolve,
      alias: {
        ...(currentConfiguration.resolve?.alias ?? {}),
        "@": path.join(process.cwd()),
      },
    },
    module: {
      ...currentConfiguration.module,
      rules: [
        ...(currentConfiguration.module?.rules
          ? currentConfiguration.module.rules
          : []
        )
          // @ts-ignore all
          .filter((rule) => {
            if (rule === "...") {
              return false;
            }
            if (rule && rule.test?.toString().includes(".css")) {
              return false;
            }
            return true;
          }),
        {
          test: /\.css$/i,
          use: [
            "style-loader",
            "css-loader",
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  plugins: [
                    "postcss-preset-env",
                    "tailwindcss",
                    "autoprefixer",
                  ],
                },
              },
            },
          ],
        },
      ],
    },
  });
