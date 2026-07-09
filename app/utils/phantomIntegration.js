/**
 * Phantom Wallet Integration
 * Handles importing wallets into Phantom
 */

export const isPhantomInstalled = () => {
  return window.phantom?.solana?.isPhantom
}

export const getPhantomProvider = () => {
  if (isPhantomInstalled()) {
    return window.phantom.solana
  }
  return null
}

/**
 * Connect to Phantom wallet
 */
export const connectPhantom = async () => {
  try {
    const provider = getPhantomProvider()
    if (!provider) {
      throw new Error('Phantom wallet not installed')
    }

    const response = await provider.connect()
    return {
      success: true,
      publicKey: response.publicKey.toString(),
      message: 'Connected to Phantom'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Disconnect from Phantom
 */
export const disconnectPhantom = async () => {
  try {
    const provider = getPhantomProvider()
    if (provider) {
      await provider.disconnect()
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Generate import instructions for Phantom
 * Since Phantom doesn't allow programmatic private key import for security,
 * we provide detailed instructions
 */
export const getPhantomImportInstructions = (wallet) => {
  return `
IMPORT WALLET INTO PHANTOM

1. Open Phantom wallet extension
2. Click the wallet icon (top right)
3. Select "Import Private Key"
4. Paste the private key below:

${wallet.secretKeyBase58}

5. Give it a name (optional)
6. Click "Import"

Your wallet will now be available in Phantom!
  `.trim()
}

/**
 * Copy instructions to clipboard
 */
export const copyImportInstructions = async (instructions) => {
  try {
    await navigator.clipboard.writeText(instructions)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Open Phantom with deep link (if available)
 */
export const openPhantomImport = (privateKey) => {
  // Note: Phantom doesn't support deep linking for security reasons
  // We'll use the manual import method instead
  const instructions = `Import this private key into Phantom:\n\n${privateKey}`
  return copyImportInstructions(instructions)
}

/**
 * Create QR code data for wallet import
 */
export const getWalletQRData = (publicKey, privateKey) => {
  // Solana Bip39 format
  return `solana:${publicKey}?key=${privateKey}`
}
