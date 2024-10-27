import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/app/utils/mongodb';
import Merchant from '@/app/models/Merchant';

export async function PATCH(req: NextRequest) {
  try {
    const { privyId, rewards, operation, tierId, ...updateFields } = await req.json();
    const userIdFromToken = req.headers.get('x-user-id');
    console.log('update fields:', updateFields)

    if (!privyId) {
      return NextResponse.json({ message: "Missing required field: privyId" }, { status: 400 });
    }

    if (!userIdFromToken || userIdFromToken !== privyId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Validate that there are fields to update or rewards operation
    const hasValidRewards = rewards && (rewards.welcome_reward !== undefined && rewards.welcome_reward !== null);
    if (Object.keys(updateFields).length === 0 && !operation && !hasValidRewards) {
      return NextResponse.json({ message: "No fields to update or invalid operation" }, { status: 400 });
    }

    const allowedFields = [
      'preferredContactMethod',
      'walletAddress',
      'taxes',
      'square.location_id',
      'square.access_token',
      'square.location_name',
      'square.refresh_token', 
      'square.merchant_id',
      'square.token_expires_at',
      'rewards.discount_type',
      'rewards.welcome_reward',
      'rewards.milestone_type',
      'rewards.tiers.name',
      'rewards.tiers.discount',
      'rewards.tiers.milestone',
      'onboardingStep',
      'name',
      'status',
    ];
    
    const fieldsToUpdate: { [key: string]: any } = {};

    // Flatten nested update fields for dot notation
    function flattenObject(ob: any, prefix = '') {
      return Object.keys(ob).reduce((toReturn: any, key) => {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof ob[key] === 'object' && !Array.isArray(ob[key])) {
          Object.assign(toReturn, flattenObject(ob[key], newKey));
        } else {
          toReturn[newKey] = ob[key];
        }
        return toReturn;
      }, {});
    }

    await connectToDatabase();

    const updateOptions: any = { new: true };  // Returns the updated document

    // Handle the 'welcome_reward' separately
    if (rewards?.welcome_reward !== undefined && rewards?.welcome_reward !== null) {
      fieldsToUpdate['rewards.welcome_reward'] = rewards.welcome_reward;
    }

    if (operation) {
      if (operation === 'add' && rewards?.tiers) {
        // First, update the rewards.discount_type and rewards.milestone_type using $set if they exist
        if (rewards.discount_type || rewards.milestone_type) {
          const setFields: { [key: string]: any } = {};
          if (rewards.discount_type) {
            setFields['rewards.discount_type'] = rewards.discount_type;
          }
          if (rewards.milestone_type) {
            setFields['rewards.milestone_type'] = rewards.milestone_type;
          }
          // Execute $set update for rewards.discount_type and rewards.milestone_type
          await Merchant.findOneAndUpdate(
            { privyId: privyId },
            { $set: setFields },
            updateOptions
          );
        }
  
        // Second, push the new tier to the rewards.tiers array using $push
        fieldsToUpdate['$push'] = { 'rewards.tiers': rewards.tiers };

      } else if (operation === 'modify' && tierId && rewards?.tiers) {
        // Prepare to modify existing tier within the rewards.tiers array
        fieldsToUpdate['$set'] = {
          'rewards.tiers.$[tier].name': rewards.tiers.name,
          'rewards.tiers.$[tier].milestone': rewards.tiers.milestone,
          'rewards.tiers.$[tier].discount': rewards.tiers.discount
        };
         // Set array filters for modification
         updateOptions.arrayFilters = [{ 'tier._id': tierId }];
         
        } else if (operation === 'delete' && tierId) {
          // Prepare to remove a specific tier from the rewards.tiers array
          fieldsToUpdate['$pull'] = { 'rewards.tiers': { _id: tierId } };
          console.log('tier to delete:', tierId)
          updateOptions.new = true;
        } else {
          // If operation is specified but does not match expected values
          return NextResponse.json({ message: "Invalid operation or missing tierId for operation" }, { status: 400 });
        }
    }

    const flattenedUpdateFields = flattenObject(updateFields);

    // Check each flattened field in the updateFields object to see if it's allowed
    Object.keys(flattenedUpdateFields).forEach((key) => {
      if (allowedFields.includes(key)) {
        fieldsToUpdate[key] = flattenedUpdateFields[key];
      }
    });

    if (Object.keys(fieldsToUpdate).length > 0) {
      const updatedMerchant = await Merchant.findOneAndUpdate(
        { privyId: privyId },
        fieldsToUpdate,
        updateOptions
      );

      // Check if the merchant was found and updated
      if (!updatedMerchant) {
        return NextResponse.json({ message: "Merchant not found" }, { status: 404 });
      }

      return NextResponse.json({ message: "Merchant updated successfully", merchant: updatedMerchant }, { status: 200 });
    } else {
      return NextResponse.json({ message: "No valid fields to update" }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating merchant:', error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
