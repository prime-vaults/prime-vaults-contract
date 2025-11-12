import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DecoderModule = buildModule("DecoderModule", (m) => {
  const decoder = m.contract("FullDecoderAndSanitizer", []);
  return { decoder };
});

export default DecoderModule;
