# Allowlist

## Overview and Motivation

Small companies often have statutory transfer restrictions in place. As they grow, they typically tend to get rid of these restrictions and abandon them entirely once they are publicly traded. This allowlist implementation is designed to flexibly and efficiently accompany the company on this journey. It is possible to have freely transferrable tokens and tokens that are subject to the allowlisting in parallel, thereby supporting an incremental path from a completely controlled state to freely transferrable token with a gradually increasing free float. If necessary, the process also can be reverted again.

## Address Types

Generally, there are four types of addresses:

- "Allowed" addresses that can receive tokens from anyone, but only send to allowlisted or powerlisted addresses.
- "Admin" addresses are like Allowed addresses, but implicitly turn target addresses into Allowed addresses, such that they can de facto transfer to anyone. If newly minted tokens need to be transfer restricted by default, the null address can be set set as "Admin", converting all new recipients to "Allowed" status during minting automatically.
- "Restricted" addresses cannot send tokens to or receive tokens from anyone, except that they can transfer tokens to "Admin" addresses.
- "Free" addresses that can send to Free, Allowed, and Admin addresses, but can only receive from other Free addresses. This is the default for new addresses.

Below is a summary table of the implemented ruleset. Rows represent the "to", colummns represent the "from" address.

|            | Fre | Alw | Res | Adm |
|------------|-----|-----|-----|-----|
| Free       |  Y  |  Y  |  N  |  Y  |
| Allowed    |  N  |  Y  |  N  |  Y  |
| Restricted |  N  |  N  |  N  |  Y  |
| Admin      |  Y  |  Y  |  N  |  Y  |

## Token Types

The token type is not stored anywhere but implied by the address they reside on. So a free float token becomes a restricted token if sent to an Allowed address.

## Limited Free Float

The use-case of having a limited free float is somewhat extraordinary and of special interest. Starting with all shares being restricted, a company could start setting some selected addresses to the 'Free' type, thereby making the tokens on these addresses freely transferrable (at least until they are transferred to an allowlisted address again). For example, a company could declare all its treasury shares free float and then start selling them while keeping transfer restrictions for the existing shareholders in place.

## Usage

- The contracts has no default constructor. Therefore, the 0x0 address is by default "Free" and all mints also become freely transferable.
- If the tokens should be only on Allowed addresses by default, the 0x0 address needs to be converted to an Admin address, thereby automatically converting recipients to Allowed
- If the 0x0 address is given Admin status, while there are already "free float" tokens in circulations, those will not automatically be transfer restricted. It is up to the issuer to choose and convert existing holders to Allowed, thereby making them subject to transfer restrictions.
- To make tokens freely transferable by default again, simply remove the Admin status from the 0x0 address.
- Additional addresses, such as the issuer multisig, can be made Admin to also distribute shares with transfer restrictions.
- "Restricted" should be used for entirely blocked tokens, such as in cases of theft or loss.
