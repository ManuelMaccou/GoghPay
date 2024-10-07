import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import QrCodeImage from '@/app/models/image';
import Merchant from '@/app/models/Merchant';
import Joi from 'joi';
import sharp from 'sharp';

// Validation schema using Joi
const schema = Joi.object({
  // paymentProvider: Joi.string().valid('Venmo', 'Zelle').required(),
  merchantId: Joi.string().required(),
  fieldToUpdate: Joi.string().required(),
});

export const runtime = 'nodejs'; // Specifies the runtime environment (Node.js is default)
export const dynamic = 'force-dynamic'; // Forces dynamic rendering

export async function POST(req: NextRequest) {
  await connectToDatabase(); // Connect to the MongoDB database

  try {
    const formData = await req.formData(); // Use formData to parse incoming form data
    const file = formData.get('image') as File; // Get the file from formData
    const crop = formData.get('crop') === 'true';
    const merchantId = formData.get('merchantId') as string;
    const fieldToUpdate = formData.get('fieldToUpdate') as string;

    // Check if file exists
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate the form data
    //const { error } = schema.validate({ paymentProvider, merchantId, fieldToUpdate });
    const { error } = schema.validate({ merchantId, fieldToUpdate });
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

    let croppedImageBuffer = buffer;
    let contentType = file.type;

    if (crop) {
      if (file.type === 'application/pdf') {
        // Convert the first page of the PDF to an image and crop it
        croppedImageBuffer = await sharp(buffer, { pages: 1 })
          .resize(500, 500, {
            fit: 'cover', 
            position: 'center',
          })
          .jpeg()
          .toBuffer();
          contentType = 'image/jpeg';
        } else if (file.type === 'image/png') {
          croppedImageBuffer = await sharp(buffer)
            .resize(500, 500, {
              fit: 'cover',
              position: 'center', 
            })
            .png()
            .toBuffer();
        } else {
          croppedImageBuffer = await sharp(buffer)
            .resize(500, 500, {
              fit: 'cover',
              position: 'center',
            })
            .jpeg()
            .toBuffer();
        }
      }

    // Save the processed image or PDF (as a cropped image) to the database
    const newImage = new QrCodeImage({
      //paymentProvider,
      contentType,
      data: croppedImageBuffer, // Save the processed buffer
    });

    const savedImage = await newImage.save();

    const updatedMerchant = await Merchant.findByIdAndUpdate(
      merchantId,
      { $set: { [fieldToUpdate]: `${process.env.NEXT_PUBLIC_BASE_URL}/api/images/${savedImage._id}` } },
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
