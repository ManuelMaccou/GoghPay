import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import QrCodeImage from '@/app/models/image';
import Merchant from '@/app/models/Merchant';
import Joi from 'joi';

// Validation schema using Joi
const schema = Joi.object({
  paymentProvider: Joi.string().valid('Venmo', 'Zelle').required(),
  merchantId: Joi.string().required(),
});

// Next.js API Route handler
export const runtime = 'nodejs';  // Specifies the runtime environment (Node.js is default)
export const dynamic = 'force-dynamic'; // Forces dynamic rendering

export async function POST(req: NextRequest) {
  await connectToDatabase();

  try {
    const formData = await req.formData(); // Use formData to parse incoming form data

    const file = formData.get('image') as File; // Get the file from formData
    const paymentProvider = formData.get('paymentProvider') as string;
    const merchantId = formData.get('merchantId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate the form data
    const { error } = schema.validate({ paymentProvider, merchantId });
    if (error) {
      return NextResponse.json({ error: error.details[0].message }, { status: 400 });
    }

    // Additional validation for file type and size
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PDF, JPEG, and PNG are allowed.' }, { status: 400 });
    }

    if (file.size > 1024 * 1024) { // Limit file size to 1MB
      return NextResponse.json({ error: 'File size exceeds the limit of 1MB.' }, { status: 400 });
    }

    // Convert the file to a Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Save the image to the database
    const newImage = new QrCodeImage({
      paymentProvider,
      contentType: file.type,
      data: buffer,
    });

    const savedImage = await newImage.save();

    // Update the corresponding field in the Merchant model
    const updateField = paymentProvider === 'Venmo' ? 'paymentMethods.venmoQrCodeImage' : 'paymentMethods.zelleQrCodeImage';

    const updatedMerchant = await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $set: { [updateField]: `${process.env.NEXT_PUBLIC_BASE_URL}/api/images/${savedImage._id}` }
      },
      { new: true }
    );

    if (!updatedMerchant) {
      return NextResponse.json({ error: 'Merchant update failed or Merchant not found.' }, { status: 404 });
    }

    return NextResponse.json({updatedMerchant, message: 'Image uploaded and saved to merchant successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error processing file upload:', error);
    return NextResponse.json({ error: 'Error uploading image' }, { status: 500 });
  }
}
