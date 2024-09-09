"use client"

import { getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from 'next/navigation';
import { AlertDialog, Button, Callout, Card, Flex, Heading, IconButton, Link, SegmentedControl, Spinner, Strong, Text, TextField, VisuallyHidden } from "@radix-ui/themes";
import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { User, RewardsTier, Rewards } from "@/app/types/types";
import { useEffect, useState } from "react";
import { useMerchant } from "@/app/contexts/MerchantContext";
import { useUser } from "@/app/contexts/UserContext";
import styles from ".//styles.module.css";
import { ExclamationTriangleIcon, Pencil2Icon, RocketIcon, TrashIcon } from "@radix-ui/react-icons";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function ManageRewards({ params }: { params: { merchantId: string } }) {  
  const router = useRouter();

  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const { merchant, isFetchingMerchant, setMerchant } = useMerchant();
  const { appUser, setIsFetchingUser } = useUser();

  const [currentUser, setCurrentUser] = useState<User>();
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [addNewMilestone, setAddNewMilestone] = useState<boolean>(false);
  const [currentRewardsTiers, setCurrentRewardsTiers] = useState<RewardsTier[]>([]);

  const [formData, setFormData] = useState({ name: "", milestone: "", discount: "" });
  const [rewardsUpdateOperation, setRewardsUpdateOperation] = useState<'add' | 'modify' | 'delete'>('add');
  const [rewardsTierIdToUpdate, setRewardsTierIdToUpdate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (appUser && !currentUser) {
      setCurrentUser(appUser);
    }
  }, [appUser, currentUser]);

  useEffect(() => {
    if (appUser) {
      const walletAddress = appUser.smartAccountAddress || appUser.walletAddress;
      setWalletForPurchase(walletAddress);
    }
  }, [appUser]);

  useEffect(() => {
    if (!merchant) return;
  
    if (merchant.rewards?.tiers) {
      setCurrentRewardsTiers(merchant.rewards.tiers);
    }
  }, [merchant]);

  const validateDiscount = (value: string): boolean => { 
    return /^[1-9]\d*$|^0$/.test(value) && parseInt(value, 10) <= 100;
  };

  const validateMilestone = (value: string): boolean => { 
    return /^[1-9]\d*$|^0$/.test(value);
  };

  // Function to check if the tier name is unique within the current rewards tiers for this merchant
  const isTierNameUnique = (tierName: string, currentRewardsTiers: Array<{ name: string }>, originalTier?: { name: string }): boolean => {
    return !currentRewardsTiers.some(tier => 
      tier.name.toLowerCase() === tierName.toLowerCase() && tier !== originalTier
    );
  };

  // Function to check if the milestone value is unique within the current rewards tiers for this merchant
  const isMilestoneUnique = (milestone: string, currentRewardsTiers: Array<{ milestone: number }>, originalTier?: { milestone: number }): boolean => {
    const milestoneValue = parseInt(milestone, 10);
    return !currentRewardsTiers.some(tier => 
      tier.milestone === milestoneValue && tier !== originalTier
    );
  };

  const updateMerchant = async (
    rewardsUpdateOperation: 'add' | 'modify' | 'delete', 
    milestone: number, 
    discount: number, 
    tier?: RewardsTier, 
    tierId?: string
  ) => {
    setIsLoading(true);
    setErrorMessage("");

    if (!appUser) {
      console.error('User data is not available');
      setErrorMessage("There was an error. Please refresh the page and try again.");
      setIsLoading(false);
      return;
    }

     // Validate milestone, discount, tier name, and milestone uniqueness on submit
    if (rewardsUpdateOperation !== 'delete') {
      const isMilestoneValid = validateMilestone(formData.milestone);
      const isDiscountValid = validateDiscount(formData.discount);

      // Only check uniqueness if adding a new tier or modifying a different name/milestone
      let isNameUnique = true;
      let isMilestoneUniqueValue = true;

      if (rewardsUpdateOperation === 'add') {
        // For adding a new tier, ensure both name and milestone are unique
        isNameUnique = isTierNameUnique(formData.name, currentRewardsTiers);
        isMilestoneUniqueValue = isMilestoneUnique(formData.milestone, currentRewardsTiers);
      } else if (rewardsUpdateOperation === 'modify' && rewardsTierIdToUpdate) {
        // For modifying an existing tier, get the original tier data
        const originalTier = currentRewardsTiers.find(tier => tier._id === rewardsTierIdToUpdate);

        if (originalTier) {
          // Only check uniqueness if the value has changed
          isNameUnique = formData.name.toLowerCase() === originalTier.name.toLowerCase() || 
                        isTierNameUnique(formData.name, currentRewardsTiers, originalTier);
          isMilestoneUniqueValue = parseInt(formData.milestone, 10) === originalTier.milestone || 
                                  isMilestoneUnique(formData.milestone, currentRewardsTiers, originalTier);
        }
      }

      if (!isMilestoneValid) {
        setIsLoading(false);
        setErrorMessage("Please enter a whole number.");
        return;
      }
      if (!isDiscountValid) {
        setIsLoading(false);
        setErrorMessage("Please enter a whole number not exceeding 100.");
        return;
      }
      if (!isNameUnique) {
        setIsLoading(false);
        setErrorMessage("Please enter a unique name.");
        return;
      }
      if (!isMilestoneUniqueValue) {
        setIsLoading(false);
        setErrorMessage("This milestone is already set.");
        return;
      }
    }

    try {
      const accessToken = await getAccessToken();

      const requestBody: any = {
        privyId: appUser.privyId,
        operation: rewardsUpdateOperation,
      };

      if (rewardsUpdateOperation === 'delete' && tierId) {
        requestBody.tierId = tierId;
        
      } else if ((rewardsUpdateOperation === 'add')) {
        // Use formData for the add operation
        requestBody.rewards = {
          discount_type: 'percent',
          milestone_type: 'dollars_spent',
          tiers: {
            name: formData.name,
            milestone: milestone,
            discount: discount,
          }
        };
      } else if (tier && rewardsUpdateOperation === 'modify' && tierId) {
        // Ensure tier object exists with expected properties
        requestBody.tierId = tierId;
        requestBody.rewards = {
          discount_type: 'percent',
          milestone_type: 'dollars_spent',
          tiers: {
            name: tier.name,
            milestone: milestone,
            discount: discount
          }
        };
      }

      const response = await fetch(`/api/merchant/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok) {
        const updatedMerchant = data.merchant; 
        setMerchant(updatedMerchant);
        setAddNewMilestone(false);
        setFormData({ name: '', milestone: '', discount: ''});
  
      } else {
        setErrorMessage(data.message || 'There was an error updating the rewards. Please refresh and try again.');
      }

      setIsLoading(false);

    } catch (error) {
      console.error('Error updating merchant:', error);
      setErrorMessage('There was an error updating the rewards. Please refresh and try again.');
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const milestone = Number(formData.milestone);
    const discount = Number(formData.discount);
  
    if (rewardsUpdateOperation === 'add') {
      updateMerchant('add', milestone, discount, { ...formData, milestone, discount } as RewardsTier);
    } else if (rewardsUpdateOperation === 'modify' && rewardsTierIdToUpdate) {
      // For modify, pass the tier ID and updated data
      updateMerchant('modify', milestone, discount, { ...formData, milestone, discount } as RewardsTier, rewardsTierIdToUpdate);
    }
  };

  const handleModify = (tier: RewardsTier) => {
    setRewardsUpdateOperation('modify');
    if (tier._id) {
      setRewardsTierIdToUpdate(tier._id);
    } else {
      setRewardsTierIdToUpdate(null);
    }
    setFormData({ 
      name: tier.name, 
      milestone: String(tier.milestone), 
      discount: String(tier.discount), 
    });
    setAddNewMilestone(true);
  };

  const handleDelete = (tierId: string) => {
    if (!tierId) {
      console.error('Invalid tier ID.');
      setErrorMessage('Invalid tier ID.');
      return;
    }
    
    console.log('tierId for delete:', tierId);
    updateMerchant('delete', 0, 0, undefined, tierId);
  };

  return (
    <Flex 
      direction='column'
      position='relative'
      minHeight='100vh'
      width='100%'
      style={{
        background: 'linear-gradient(to bottom, #ff962d 0%,#ff7b0d 12%)'
      }}
    >
      <Flex direction={'row'} justify={'between'} align={'center'} px={'4'} height={'120px'}>
        <Heading size={'8'} style={{color: "white"}}>Rewards</Heading>
        <BalanceProvider walletForPurchase={walletForPurchase}>
          <Header
            color={"white"}
            merchant={currentUser?.merchant}
            embeddedWallet={embeddedWallet}
            authenticated={authenticated}
            walletForPurchase={walletForPurchase}
            currentUser={currentUser}
          />
        </BalanceProvider>
      </Flex>
      <Flex
        flexGrow={'1'}
        p={'7'}
        direction={'column'}
        gap={'5'}
        align={'center'}
        height={'100%'}
        style={{
          backgroundColor: 'white',
          borderRadius: '20px 20px 0px 0px',
          boxShadow: 'var(--shadow-6)'
        }}
      >
        {ready && authenticated ? (
          currentUser && !isFetchingMerchant && merchant ? (
            !addNewMilestone ? (

              currentRewardsTiers.length === 0 && !isLoading ? (
                <>
                  <Text size={'5'} align={'center'}>
                    Incentivize your customers to spend more and visit often with automated rewards. 
                    You&apos;ll configure your reward milestones once and discounts will be automatically applied 
                    at checkout for in-person sales. Rewards for online sales coming soon.
                  </Text>
                  <Button style={{width: '250px'}} onClick={() => setAddNewMilestone(true)}>
                    Get Started
                  </Button>
                </>
              ) : currentRewardsTiers.length > 0 && !isLoading ? (
                <>
                  <Heading>Manage Rewards</Heading>
                  <Text>When a customer reaches a milestone, they will be rewarded with a discount on future purchases.</Text>

                  <Flex direction={'column'} width={'100%'} maxHeight={'55vh'} overflow={'scroll'} gap={'3'}>
                    {currentRewardsTiers
                    .sort((a, b) => a.milestone - b.milestone) // Sort by milestone in ascending order
                    .map((tier) => (
                      <Card key={tier._id} variant="surface" style={{ flexShrink: 0 }}>
                        <Flex direction={'row'} gap={'3'} width={'100%'} justify={'between'} height={'80px'}>
                          <Flex direction={'column'} gap={'3'} flexGrow={'1'}>
                            <Text as="div" size="2" weight="bold">
                              {tier.name}
                            </Text>
                            <Text as="div" color="gray" size="2">
                              Amount to spend: ${tier.milestone}
                            </Text>
                            <Flex direction={'row'} width={'100%'} justify={'between'} flexGrow={'1'}>
                              <Text as="div" color="gray" size="2">
                                Discount: {tier.discount}%
                              </Text>
                            </Flex>
                          </Flex>
                          <Flex direction={'column'} justify={'between'} flexShrink={'1'}>
                            <IconButton variant="ghost" size={'3'} onClick={() => handleModify(tier)}>
                              <Pencil2Icon width={'22'} height={'22'} />
                            </IconButton>
                          </Flex>
                        </Flex>
                      </Card>
                    ))}
                  </Flex>
                  <Button variant="ghost" 
                    onClick={() => {
                      setAddNewMilestone(true);
                      setRewardsUpdateOperation('add');
                    }}>
                    + add milestone
                  </Button>
                </>
              ) : null
            ) : (
              <Flex direction={'column'} align={'center'} justify={'between'} width={'100%'} height={'100%'}>
                <form onSubmit={handleSubmit} className={styles.formGroup}>
                  <Flex direction={'column'} justify={'center'}>
                    <label htmlFor="name" className={styles.formLabel}>
                      Milestone name
                    </label>
                    <TextField.Root
                      placeholder="Milestone 1"
                      mb={'5'}
                      mt={'1'}
                      type="text"
                      size={'3'}
                      name="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    <label htmlFor="milestone" className={styles.formLabel}>
                      Minimum needed to spend
                    </label>
                    <TextField.Root
                      mb={'5'}
                      mt={'1'}
                      type="number"
                      size={'3'}
                      name="milestone"
                      value={formData.milestone}
                      onChange={(e) => setFormData({ ...formData, milestone: e.target.value })}
                      required
                      style={{width: '100px'}}
                    >
                      <TextField.Slot side='left'>
                        <Text>$</Text>
                      </TextField.Slot>
                    </TextField.Root>
                    <label htmlFor="discount" className={styles.formLabel}>
                      Discount
                    </label>
                    <TextField.Root
                      mb={'5'}
                      mt={'1'}
                      type="number"
                      size={'3'}
                      name="discount"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                      required
                      style={{width: '100px'}}
                    >
                      <TextField.Slot side='right'>
                        <Text>% off</Text>
                      </TextField.Slot>
                    </TextField.Root>
                  </Flex>
                  <Flex direction={'column'} width={'100%'}>
                    <Callout.Root>
                      <Callout.Icon>
                        <RocketIcon />
                      </Callout.Icon>
                        {!formData.discount && !formData.milestone && (
                          <Callout.Text size={'3'} align={'left'}>The customer must spend...</Callout.Text>
                        )}
      
                        {!formData.discount && formData.milestone && (
                          <Callout.Text size={'3'}>
                            The customer must spend ${formData.milestone} to receive
                            a discount of...
                          </Callout.Text>
                        )}
      
                        {formData.discount && !formData.milestone && (
                          <Callout.Text size={'3'}>
                            The customer must spend... to receive
                            a discount of {formData.discount}% on all future purchases 
                          </Callout.Text>
                        )}
      
                        {formData.discount && formData.milestone && (
                          <Callout.Text size={'3'}>
                            The customer must spend ${formData.milestone} to receive
                            a discount of {formData.discount}% on all future purchases
                          </Callout.Text>
                        )}
                    </Callout.Root>
                    <Flex direction={'column'} mt={'5'} justify={'center'}>
                      {errorMessage && <Text align={'center'} color="red">{errorMessage}</Text>}
                    </Flex>
                  
                    <Flex direction={'row'} justify={'between'} align={'center'} mt={'6'} mb={'7'}>
                      <Button variant="ghost" size={'4'} style={{width: '150px'}}
                        onClick={() => {
                          setAddNewMilestone(false); 
                          setErrorMessage("")
                        }}>
                        Cancel
                      </Button>
                      <Button my={'4'} size={'4'} type="submit" loading={isLoading} style={{width: '150px'}}>
                        Submit
                      </Button>
                    </Flex>
      
                    {rewardsUpdateOperation === 'modify' && (
                      <AlertDialog.Root>
                        <AlertDialog.Trigger>
                          <Button size={'3'} variant="ghost" color="red">Remove milstone</Button>
                        </AlertDialog.Trigger>
                        <AlertDialog.Content maxWidth="450px">
                          <VisuallyHidden>
                            <AlertDialog.Title>Delete rewards milestone</AlertDialog.Title>
                          </VisuallyHidden>
                          <AlertDialog.Description size="2">
                            Delete rewards milestone?
                          </AlertDialog.Description>
      
                          <Flex gap="3" mt="4" justify='between'>
                            <AlertDialog.Cancel>
                              <Button variant="soft" color="gray">
                                Cancel
                              </Button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action>
                              <Button variant="solid" color="red" onClick={() => handleDelete(rewardsTierIdToUpdate!)}>
                                Yes
                              </Button>
                            </AlertDialog.Action>
                          </Flex>
                        </AlertDialog.Content>
                      </AlertDialog.Root>
                    )}
                  </Flex>
                </form>
              </Flex>
            )
          ) : currentUser && !isFetchingMerchant && !merchant ? (
          <>
            <Callout.Root color='red' role='alert'>
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Text>
                <Strong>Unauthorized.</Strong> This page is for merchants only. You can{' '}
                <Link href='https://www.ongogh.com' target='_blank' rel='noopener noreferrer'>
                  request access here.
                </Link>
                  If you think this is a mistake, please{' '}
                <Link href='mailto: hello@ongogh.com' target='_blank' rel='noopener noreferrer'>
                  contact us.
                </Link>
              </Callout.Text>
            </Callout.Root>
            <Button variant="ghost" style={{ width: '250px' }} size={'4'}  onClick={() => router.push("/")}>
              Return home
            </Button>
          </>
        ) : null

        
    
      ) : ready && !authenticated && (
        <Button variant="ghost" style={{ width: '250px' }} size={'4'}  onClick={() => router.push("/")}>
          Please log in to view this page
        </Button>
      )}

      
      </Flex>
    </Flex>
  )
}