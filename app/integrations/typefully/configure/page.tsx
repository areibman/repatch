import { loadTypefullyConfig } from "../actions";
import TypefullyConfigureClient from "../TypefullyConfigureClient";

export default async function TypefullyConfigurePage() {
  const config = await loadTypefullyConfig();
  return <TypefullyConfigureClient config={config} />;
}
