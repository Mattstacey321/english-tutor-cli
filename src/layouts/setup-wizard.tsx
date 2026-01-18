import { useState } from "react";
import { defaultModelFor, TutorConfig, writeConfig } from "../config";
import type { ProviderName } from "../providers/types";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface SetupWizardProps {
  configPath: string;
  configError: string | null;
  onComplete: (config: TutorConfig) => void;
}

type SetupState = {
  step: "provider" | "model" | "apikey" | "confirm";
  provider: ProviderName;
  model: string;
  apiKey: string;
  error: string | null;
};

export const SetupWizard = ({
  configPath,
  configError,
  onComplete,
}: SetupWizardProps) => {
  const [entry, setEntry] = useState("");
  const [state, setState] = useState<SetupState>({
    step: "provider",
    provider: "openai",
    model: defaultModelFor("openai"),
    apiKey: "",
    error: null,
  });

  const advanceProvider = (input: string) => {
    const value = input.trim().toLowerCase();
    if (value === "1" || value === "openai") {
      setState((current) => ({
        ...current,
        provider: "openai",
        model: defaultModelFor("openai"),
        step: "model",
        error: null,
      }));
      setEntry("");
      return;
    }

    if (value === "2" || value === "gemini") {
      setState((current) => ({
        ...current,
        provider: "gemini",
        model: defaultModelFor("gemini"),
        step: "model",
        error: null,
      }));
      setEntry("");
      return;
    }

    setState((current) => ({
      ...current,
      error: "Enter 1 (OpenAI) or 2 (Gemini).",
    }));
  };

  const advanceModel = (input: string) => {
    const model = input.trim() || defaultModelFor(state.provider);
    setState((current) => ({ ...current, model, step: "apikey", error: null }));
    setEntry("");
  };

  const advanceApiKey = (input: string) => {
    const apiKey = input.trim();
    const envKey =
      state.provider === "gemini"
        ? process.env.GEMINI_API_KEY
        : process.env.OPENAI_API_KEY;
    if (!apiKey && !envKey) {
      setState((current) => ({
        ...current,
        error: `Missing ${state.provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"}.`,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      apiKey,
      step: "confirm",
      error: null,
    }));
    setEntry("");
  };

  const advanceConfirm = (input: string) => {
    const value = input.trim().toLowerCase();
    if (value === "y") {
      const config: TutorConfig = {
        provider: state.provider,
        model: state.model,
        ...(state.apiKey ? { apiKey: state.apiKey } : {}),
      };
      writeConfig(config);
      onComplete(config);
      setEntry("");
      return;
    }

    if (value === "n") {
      setState((current) => ({ ...current, step: "provider", error: null }));
      setEntry("");
      return;
    }

    setState((current) => ({
      ...current,
      error: "Type y to save or n to restart.",
    }));
  };

  return (
    <Box flexDirection="column" padding={2}>
      {/* Header */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
        padding={1}
        marginBottom={1}
      >
        <Text bold color="cyan">
          🎓 English Tutor CLI - Setup Wizard
        </Text>
        <Text color="gray">
          Config will be saved to: {configPath}
        </Text>
        {configError && (
          <Box marginTop={1}>
            <Text color="yellow">
              ⚠️ Config warning: {configError}
            </Text>
          </Box>
        )}
      </Box>

      {/* Step Indicator */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        marginBottom={1}
        paddingX={1}
      >
        <Text color="gray">
          Step {["provider", "model", "apikey", "confirm"].indexOf(state.step) + 1}/4
        </Text>
        <Text color="cyan">
          {state.step === "provider" && "Select Provider"}
          {state.step === "model" && "Choose Model"}
          {state.step === "apikey" && "API Key"}
          {state.step === "confirm" && "Confirm"}
        </Text>
      </Box>

      {/* Step Content */}
      <Box
        borderStyle="single"
        borderColor="gray"
        padding={1}
        marginBottom={1}
      >
        {state.step === "provider" && (
          <>
            <Text bold color="cyan">
              🤖 Select AI Provider
            </Text>
            <Box marginTop={0.5}>
              <Text color="gray">
                Choose your preferred AI provider:
              </Text>
            </Box>
            <Box marginTop={1} paddingLeft={2}>
              <Text color="green">1) OpenAI</Text>
              <Text color="green">2) Gemini</Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={entry}
                onChange={setEntry}
                onSubmit={advanceProvider}
                placeholder="Enter 1 or 2"
              />
            </Box>
          </>
        )}

        {state.step === "model" && (
          <>
            <Text bold color="cyan">
              📦 Select Model
            </Text>
            <Box marginTop={0.5}>
              <Text color="gray">
                Enter model name for {state.provider}:
              </Text>
            </Box>
            <Box marginTop={0.5}>
              <Text color="yellow">
                Default: {defaultModelFor(state.provider)}
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={entry}
                onChange={setEntry}
                onSubmit={advanceModel}
                placeholder={defaultModelFor(state.provider)}
              />
            </Box>
          </>
        )}

        {state.step === "apikey" && (
          <>
            <Text bold color="cyan">
              🔑 API Key
            </Text>
            <Box marginTop={0.5}>
              <Text color="gray">
                Enter your {state.provider === "gemini" ? "Gemini" : "OpenAI"} API key:
              </Text>
            </Box>
            <Box marginTop={0.5}>
              <Text color="yellow">
                Or leave blank to use environment variable:{" "}
                {state.provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"}
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={entry}
                onChange={setEntry}
                onSubmit={advanceApiKey}
                placeholder="sk-..."
                mask="*"
              />
            </Box>
          </>
        )}

        {state.step === "confirm" && (
          <>
            <Text bold color="cyan">
              ✅ Confirm Setup
            </Text>
            <Box marginTop={0.5}>
              <Text color="gray">
                Review your configuration:
              </Text>
            </Box>
            <Box marginTop={1} paddingLeft={2}>
              <Text color="green">Provider: {state.provider}</Text>
              <Text color="green">Model: {state.model}</Text>
              {state.apiKey && <Text color="green">API Key: Set</Text>}
              {!state.apiKey && <Text color="yellow">API Key: From env</Text>}
            </Box>
            <Box marginTop={1}>
              <Text color="gray">
                Save and start tutor? (y/n)
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={entry}
                onChange={setEntry}
                onSubmit={advanceConfirm}
                placeholder="y"
              />
            </Box>
          </>
        )}
      </Box>

      {/* Error Display */}
      {state.error && (
        <Box
          borderStyle="single"
          borderColor="red"
          padding={1}
          marginBottom={1}
        >
          <Text color="red">❌ {state.error}</Text>
        </Box>
      )}

      {/* Tips */}
      <Box
        borderStyle="single"
        borderColor="gray"
        padding={1}
      >
        <Text color="gray" italic>
          💡 Tip: You can also set PROVIDER, MODEL, and API keys via environment
          variables before running the app.
        </Text>
      </Box>
    </Box>
  );
};
