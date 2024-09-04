import { NextRequest, NextResponse } from 'next/server';
import QrCodeImage from '@/app/models/image';
import connectToDatabase from '@/app/utils/mongodb';

export async function GET (request: NextRequest,
  { params }: { params: { imageId: string } }) {
    const imageId = params.imageId

  if (!imageId) {
    return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const image = await QrCodeImage.findById(imageId);

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    return new Response(image.data.buffer, {
      headers: {
        'Content-Type': image.contentType,
        'Content-Disposition': `inline; filename="file.pdf"`, // Suggesting filename and inline view
      },
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json({ error: 'Error fetching image' }, { status: 500 });
  }
}
