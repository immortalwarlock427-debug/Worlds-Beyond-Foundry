export function imagePicker(options) {
  const NativePicker = foundry.applications.apps.FilePicker.implementation;
  class WorldsBeyondImagePicker extends NativePicker {
    async _onRender(context, renderOptions) {
      // v14 rebinds upload listeners when the browser rerenders. The upload
      // control can survive a partial render, so remove its old listeners first.
      const upload = this.element?.elements?.upload;
      if (upload) upload.replaceWith(upload.cloneNode(true));
      return super._onRender(context, renderOptions);
    }
  }
  return new WorldsBeyondImagePicker({ type: "image", ...options });
}
