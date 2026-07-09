export async function POST(request) {
  try {
    const { name, symbol, description } = await request.json()

    if (!name || !symbol) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    return Response.json({
      success: true,
      uri: `ipfs://Qm${Math.random().toString(36).substring(7)}`,
      message: 'Metadata ready for upload'
    })
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
