export default defineNuxtRouteMiddleware(() => {
  const { isLoggedIn } = useAccountStore();

  if (!isLoggedIn) {
    return navigateTo("/");
  }
});
