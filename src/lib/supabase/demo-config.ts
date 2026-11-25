export function getDemoCredentials() {
  const email = process.env.DEMO_EMAIL?.trim() ?? "";
  const password = process.env.DEMO_PASSWORD?.trim() ?? "";

  return {
    email,
    password,
    isConfigured: email.length > 0 && password.length > 0,
  };
}
