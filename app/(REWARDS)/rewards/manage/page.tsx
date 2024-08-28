"use client"

import { getEmbeddedConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { Button, Callout, Flex, Heading, Spinner, Text, TextField } from "@radix-ui/themes";
import { Header } from "@/app/components/Header";
import { BalanceProvider } from "@/app/contexts/BalanceContext";
import { User } from "@/app/types/types";
import { useEffect, useState } from "react";
import { useMerchant } from "@/app/context/MerchantContext";
import { useUser } from "@/app/context/UserContext";
import styles from ".//styles.module.css";
import { RocketIcon } from "@radix-ui/react-icons";

function isError(error: any): error is Error {
  return error instanceof Error && typeof error.message === "string";
}

export default function ManageRewards({ params }: { params: { merchantId: string } }) {  
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  const { merchant, isFetchingMerchant } = useMerchant();
  const { appUser, setIsFetchingUser } = useUser();

  const [currentUser, setCurrentUser] = useState<User>();
  const [walletForPurchase, setWalletForPurchase] = useState<string | null>(null);
  const [addNewMilestone, setAddNewMilestone] = useState<boolean>(false);

  const [formData, setFormData] = useState({ name: "", milestone: "", discount: "" });
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


  const validateMilestoneAndDiscount = (value: string): boolean => { 
    // Must be a positive whole number
    const validValue = /^[1-9]\d*$|^0$/.test(value);
    return validValue;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (!appUser) {
      console.error('User data is not available');
      setErrorMessage("There was an error. Please refresh the page and try again.");
      return;
    }

    // Validate milestone and discount on submit
    if (!validateMilestoneAndDiscount(formData.milestone)) {
      setIsLoading(false);
      setErrorMessage("Please enter a whole number for the milestone and discount.");
      return;
    }

    if (!validateMilestoneAndDiscount(formData.discount)) {
      setIsLoading(false);
      setErrorMessage("Please enter a whole number for the milestone and discount.");
      return;
    }

    // Convert validated string inputs to numbers
    const formattedMilestone = Number(formData.milestone);
    const formattedDiscount = Number(formData.discount);
    
    try {
      const accessToken = await getAccessToken();

      await fetch(`/api/loyalty/milestone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, 
        },
        body: JSON.stringify({
          privyId: appUser?.privyId,
          name: formData.name,
          milestone: formattedMilestone,
          discount: formattedDiscount
        })
      });

      setFormData({ name: "", milestone: "", discount: "", });
      setAddNewMilestone(false)
    } catch (error) {
      setErrorMessage("Failed to add rewards milestone. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Flex direction={'column'} pt={'6'} pb={'4'} px={'4'} gap={'5'} height={'100vh'} flexGrow={'1'}>
        {isFetchingMerchant && <Spinner />}

        {ready && authenticated && currentUser && !isFetchingMerchant && merchant && appUser &&(
          <BalanceProvider walletForPurchase={walletForPurchase}>
            <Header
              merchant={currentUser?.merchant}
              embeddedWallet={embeddedWallet}
              authenticated={authenticated}
              walletForPurchase={walletForPurchase}
              currentUser={currentUser}
            />
          </BalanceProvider>
        )}
          
            {!merchant?.loyalty && !addNewMilestone ? (
              <>
                <Flex direction={'column'} align={'center'} justify={'center'} gap={'5'} flexGrow={'1'} mt={'-9'}>
                  <Heading>Gogh Rewards</Heading>
                  <Text size={'5'} align={'center'}>
                    Incentivize your customers to spend more and visit often with automated rewards. 
                    You&apos;ll configure your reward milestones once and discounts will be automatically applied 
                    at checkout for in-person and online sales.
                  </Text>
                  <Button style={{width: '250px'}} onClick={() => setAddNewMilestone(true)}>
                    Get Started
                  </Button>
                </Flex>
              </>

            ) : merchant?.loyalty && !addNewMilestone && (
              <Heading>Current milestones</Heading>

              

          
            )}

            {/* MAKE THIS A '?' INSTEAD */}
            {addNewMilestone && (
              <>
                <Heading>New Rewards Milestone</Heading>
                <Text>Create a milestone that your customers must reach before being rewarded with a discount</Text>

                <Flex direction={'column'} align={'center'} justify={'between'} minWidth={'70%'} height={'100%'}>
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
                        size={'2'}
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
                        size={'2'}
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
                        size={'2'}
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
                            <Callout.Text align={'left'}>The customer must spend...</Callout.Text>
                          )}

                          {!formData.discount && formData.milestone && (
                            <Callout.Text>
                              The customer must spend ${formData.milestone} to receive
                              a discount of...
                            </Callout.Text>
                          )}

                          {formData.discount && !formData.milestone && (
                            <Callout.Text>
                             The customer must spend... to receive
                             a discount of {formData.discount}% on all future purchases 
                            </Callout.Text>
                          )}

                          {formData.discount && formData.milestone && (
                            <Callout.Text>
                              The customer must spend ${formData.milestone} to receive
                              a discount of {formData.discount}% on all future purchases
                            </Callout.Text>
                          )}
                      </Callout.Root>


                      
                      
                      <Flex direction={'column'} align={'center'} width={'100%'} mt={'6'} gap={'4'}>
                      {errorMessage && <Text color="red">{errorMessage}</Text>}
                      <Button my={'4'} type="submit" loading={isLoading} style={{width: '250px'}}>
                        Done
                      </Button>
                      <Button variant="ghost" style={{width: '250px'}} onClick={() => setAddNewMilestone(false)}>
                        Cancel
                      </Button>
                  
                      
                      </Flex>
                    </Flex>
                  </form>
                </Flex>
              </>

            )}






          </Flex>
  
    </>
  )
}