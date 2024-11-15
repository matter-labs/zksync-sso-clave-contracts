export default defineNuxtRouteMiddleware((to) => {
  const { isLoggedIn } = useAccountStore();

  if (isLoggedIn) {
    switch (to.path) {
      case "/":
        return navigateTo("/dashboard");
    }
  }
});
