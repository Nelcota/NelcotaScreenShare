/** The next camera in the list, going back to the first after the last. */
export function nextCamera(
  devices: readonly { deviceId: string }[],
  activeId: string,
): string | undefined {
  const usable = devices.filter(
    (device) => device.deviceId !== "" && device.deviceId !== "default",
  );
  if (usable.length < 2) return undefined;
  const index = usable.findIndex((device) => device.deviceId === activeId);
  return usable[(index + 1) % usable.length]?.deviceId;
}
