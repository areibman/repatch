import { Composition } from "remotion";
import BaseComp, { ParsedPropsSchema, BaseCompProps } from "./BaseComp";

// Default fallback data for when no video data is provided
export const defaultVideoData: ParsedPropsSchema = {
  langCode: "en",
  topChanges: [
    {
      title: "Repository Updates",
      description: "Active development and improvements",
    },
  ],
  allChanges: [
    "Various bug fixes and improvements",
    "Code refactoring and optimization",
    "Documentation updates",
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
        repositorySlug: "Example/Repo",
        releaseTag: "latest",
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
