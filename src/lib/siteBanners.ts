/** Banners encerrados continuam na API; não devem voltar à capa do site. */
export function isActiveSiteBannerImage(image: string): boolean {
  // Mesma regra do preload/HTML inicial em public/index.php.
  return !/NetCar-Banner-0109\.jpg|\/images\/campaigns\/acelerou-levou\//i.test(
    image.replace(/\\/g, "/"),
  );
}
