import { Composition } from "remotion";
import BaseComp, { ParsedPropsSchema, BaseCompProps } from "./BaseComp";

// Default fallback data for when no video data is provided
export const defaultVideoData: ParsedPropsSchema = {
  langCode: "en",
  topChanges: [
    {
      title: "Visual editing for your React props",
      description: "New Props editor allows for editing props with schema",
    },
    {
      title: "Render Button for faster media creation",
      description: "New Render button allows for rendering through the CLI",
    },
    {
      title: "Rust-based architecture for faster renders",
      description: "Rust-based frame extractor for improved performance",
    },
    {
      title: "Migration to v4.0.0",
      description: "Major breaking changes and new features",
    },
  ],
  allChanges: [
    "remotion: defaultProps of a <Composition> is now mandatory if the component accepts props",
    "remotion: <Composition> now accepts a schema",
    "remotion: <Composition> now accepts a calculateMetadata prop",
    "remotion: The OffthreadVideoImageFormat type has been removed",
    "remotion: imageFormat has been removed from <OffthreadVideo>",
    "remotion: transparent has been added to <OffthreadVideo>",
    "remotion: <Img> will cancel the render if the image cannot be loaded",
    "remotion: If an <Audio> tag cannot be loaded, it will cancel the render",
    "remotion: The TComposition type now requires a Zod schema as a generic",
    "remotion: Type WebpackOverrideFn moved from remotion to @remotion/bundler",
    "remotion: staticFile() now supports URI-unsafe characters by default",
    "remotion: Types: src is required for an <Img> tag",
    "@remotion/bundler: The development Webpack cache will not be removed anymore if setting --bundle-cache=false",
    "@remotion/bundler: react-native no longer aliases to react-native-web",
    "@remotion/bundler: Webpack has been upgraded to 5.83.1",
    "@remotion/cli: npx remotion preview is deprecated for npx remotion studio",
    "@remotion/cli: New Props editor allows for editing props with schema",
    "@remotion/cli: New Render button allows for rendering through the CLI",
    "@remotion/cli: New npx remotion ffmpeg command",
    "@remotion/cli: New npx remotion ffprobe command",
    "@remotion/cli: Configuration logic has been moved to @remotion/cli/config",
    "@remotion/cli: Rich timeline was removed",
    "@remotion/cli: Config.*.setOption() syntax has been removed",
    "@remotion/cli: Config.setOutputFormat() has now been removed",
    "@remotion/cli: Studio now has custom dark scrollbars",
    "@remotion/cli: New logger for verbose mode: No more interlacing between logs and progress bars",
    "@remotion/cli: New indicator whether a file has been overwritten (○) or newly created (+)",
    "@remotion/cli: Printing server URL again to the console if all Studio instances have been closed",
    "@remotion/cli: Less React re-renders across the Remotion Studio",
    "@remotion/cli: Dropdowns cannot overflow anymore",
    "@remotion/cli: New shortcut for collapsing left sidebar: Cmd/Ctrl+B",
    "@remotion/cli: Allow open of the project in editor from the Remotion Studio",
    "@remotion/cli: Date objects now work properly in defaultProps",
    "@remotion/cli: Remotion Studio is tested to work well offline",
    "@remotion/cli: 'Remotion Preview' has been renamed to 'Remotion Studio'",
    "@remotion/eslint-config: eslint-plugin-react has been updated to 7.32.2",
    "@remotion/eslint-config: eslint-plugin-react-hooks has been updated to 4.6.0",
    "@remotion/eslint-plugin: New ESLint rule: Use the right import in the config file",
    "@remotion/lambda: Lambda does not support the x86 architecture anymore",
    "@remotion/lambda: Chrome on Lambda has been updated to 114",
    "@remotion/lambda: downloadVideo() alias has been removed",
    "@remotion/lambda: estimatePrice() does not accept architecture anymore",
    "@remotion/lambda: Removed FFmpeg from the Lambda Layer",
    "@remotion/motion-blur: <MotionBlur> has been removed",
    "@remotion/paths: getParts() has been removed",
    "@remotion/renderer: New selectComposition() API",
    "@remotion/renderer: getCanExtractFramesFast() has been removed",
    "@remotion/renderer: FFmpeg is now included in Remotion (v6.0), no need to install it anymore",
    "@remotion/renderer: ProRes now exports uncompressed audio by default",
    "@remotion/renderer: onSlowestFrames has been removed",
    "@remotion/renderer: renderMedia() now returns an object instead of a Buffer",
    "@remotion/renderer: The ImageFormat type has been removed in favor of StillImageFormat and VideoImageFormat",
    "@remotion/renderer: You can now export stills as PDF or WebP",
    "@remotion/renderer: quality is now jpegQuality",
    "@remotion/renderer: Removed ensureFfmpeg() and ensureFfprobe()",
    "@remotion/renderer: <OffthreadVideo> now uses a Rust-based frame extractor",
    "@remotion/renderer: Noisy Chrome messages are filtered out",
    "@remotion/renderer: console.log statements in your React app now get printed in a tidy format",
    "@remotion/zod-types: New package!",
    "All packages: The minimum Node version is now 16.0.0",
    "All packages: ESLint has been upgraded to 8.42.0",
    "All packages: TypeScript ESLint has been upgraded to 5.59.9",
    "All packages: ESBuild has been updated to 0.18.6",
    "For contributors: Updated pnpm to 8.5.1",
    "For contributors: Doc snippets failing typechecks now show the failing code in CI",
    "New Google TTS template!",
    "Recommended Docker file does not install ffmpeg anymore",
  ],
};

export type RemotionInputProps = {
  openaiGeneration?: ParsedPropsSchema;
  repositorySlug?: string;
  releaseTag?: string;
  langCode?: string;
};

export function getDuration(parsed: ParsedPropsSchema) {
  // 81 frames per top change, plus 555 for intro/outro
  return 81 * parsed.topChanges.length + 555;
}

export const RemotionComp: React.FC = () => {
  return (
    <Composition
      id="basecomp"
      component={BaseComp as any}
      width={2160}
      height={1080}
      fps={30}
      defaultProps={{
        repositorySlug: "remotion-dev/remotion",
        releaseTag: "v4.0.0",
        openaiGeneration: defaultVideoData,
        langCode: "en",
      }}
      calculateMetadata={async ({ props }) => {
        const parsed = props.openaiGeneration ?? defaultVideoData;
        const durationInFrames = getDuration(parsed);
        return { durationInFrames };
      }}
    />
  );
};
