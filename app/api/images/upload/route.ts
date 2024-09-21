import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import QrCodeImage from '@/app/models/image';
import Merchant from '@/app/models/Merchant';
import Joi from 'joi';
import sharp from 'sharp';

// Validation schema using Joi
const schema = Joi.object({
  paymentProvider: Joi.string().valid('Venmo', 'Zelle').required(),
  merchantId: Joi.string().required(),
});

export const runtime = 'nodejs'; // Specifies the runtime environment (Node.js is default)
export const dynamic = 'force-dynamic'; // Forces dynamic rendering

export async function POST(req: NextRequest) {
  await connectToDatabase(); // Connect to the MongoDB database

  try {
    const formData = await req.formData(); // Use formData to parse incoming form data
    const file = formData.get('image') as File; // Get the file from formData
    const paymentProvider = formData.get('paymentProvider') as string;
    const merchantId = formData.get('merchantId') as string;

    // Check if file exists
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate the form data
    const { error } = schema.validate({ paymentProvider, merchantId });
    if (error) {
      return NextResponse.json({ error: error.details[0].message }, { status: 400 });
    }

    // Validate file type and size
    const supportedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, and PDF are allowed.' }, { status: 400 });
    }

    if (file.size > 1024 * 1024) { // Limit file size to 1MB
      return NextResponse.json({ error: 'File size exceeds the limit of 1MB.' }, { status: 400 });
    }

    // Convert the file to a buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    let croppedImageBuffer;

    if (file.type === 'application/pdf') {
      // Convert the first page of the PDF to an image and crop it
      croppedImageBuffer = await sharp(buffer, { pages: 1 })
        .resize(500, 500, {
          fit: 'cover', // Ensure the image is cropped to exactly 500x500
          position: 'center', // Center the image when cropping
        })
        .jpeg() // Convert to JPEG for storage
        .toBuffer();
    } else {
      // For image files (JPEG/PNG), crop and resize
      croppedImageBuffer = await sharp(buffer)
        .resize(500, 500, {
          fit: 'cover', // Ensure the image is cropped to exactly 500x500
          position: 'center', // Center the image when cropping
        })
        .toBuffer();
    }

    // Save the processed image or PDF (as a cropped image) to the database
    const newImage = new QrCodeImage({
      paymentProvider,
      contentType: 'image/jpeg', // Store as JPEG (for both images and PDFs)
      data: croppedImageBuffer, // Save the processed buffer
    });

    const savedImage = await newImage.save();

    // Update the corresponding field in the Merchant model
    const updateField = paymentProvider === 'Venmo' ? 'paymentMethods.venmoQrCodeImage' : 'paymentMethods.zelleQrCodeImage';

    const updatedMerchant = await Merchant.findByIdAndUpdate(
      merchantId,
      {
        $set: { [updateField]: `${process.env.NEXT_PUBLIC_BASE_URL}/api/images/${savedImage._id}` }, // Save the image path
      },
      { new: true }
    );

    if (!updatedMerchant) {
      return NextResponse.json({ error: 'Merchant update failed or Merchant not found.' }, { status: 404 });
    }

    return NextResponse.json({ updatedMerchant, message: 'Image or PDF uploaded, processed, and saved to merchant successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error processing file upload:', error);
    return NextResponse.json({ error: 'Error uploading image or PDF' }, { status: 500 });
  }
}
