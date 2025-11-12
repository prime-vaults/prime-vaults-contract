import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Decoder Module
 * Deploys FullDecoderAndSanitizer for sanitizing and validating strategy calls
 */
export default buildModule("DecoderModule", (m) => {
  const decoder = m.contract("FullDecoderAndSanitizer");

  return { decoder };
});
