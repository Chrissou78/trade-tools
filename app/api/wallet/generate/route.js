import { Keypair } from '@solana/web3.js'

export async function POST(request) {
  try {
    const { count = 1 } = await request.json()

    if (count > 100) {
      return Response.json(
        { error: 'Cannot generate more than 100 wallets at once' },
        { status: 400 }
      )
    }

    const wallets = []

    for (let i = 0; i < count; i++) {
      const keypair = Keypair.generate()
      wallets.push({
        publicKey: keypair.publicKey.toString(),
        secretKey: Array.from(keypair.secretKey),
        createdAt: new Date().toISOString()
      })
    }

    return Response.json({
      success: true,
      count: wallets.length,
      wallets
    })
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
