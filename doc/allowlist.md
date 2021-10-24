# Allowlist

## Overview and Motivation

Small companies often have statutory transfer restrictions in place. As they grow, they typically tend to get rid of these restrictions
and abandon them entirely once they are publicly traded. This allowlist implementation is designed to flexibly and efficiently accompany the company on this journey. It is possible to have freely transferrable tokens and tokens that are subject to the allowlisting in parallel, thereby supporting an incremental path from a completely controlled state to freely transferrable token with a gradually increasing free float. If necessary, the process also can be reverted again.

## Address Types

Generally, there are four types of addresses:
- Allowlisted addresses that can receive tokens from anyone, but only send to allowlisted or powerlisted addresses.
- Powerlisted addresses are like allowlisted addresses, but implicitely turn target addresses into allowlisted addresses, such that they can de facto transfer to anyone. The null address is powerlisted by default, ensuring that no explicit allowlisting is needed when minting tokens and that new tokens are not free float.
- Forbidden addresses that cannot receive tokens from anyone, but can send them to allowlisted or powerlisted addresses.
- Free addresses that can send to free, allowlisted, and powerlisted addresses, but can only receive from other free addresses. This is the default for new addresses.

## Token Types

We distinguish between two token types, whereas their type depends on the address they reside on:
- Restricted tokens that can only be sent to allowlisted addresses
- Free float tokens that can be sent to any address except explicitely forbidden ones

The token type is not stored anywhere but implied by the address they reside on. So a free float token becomes a restricted token if sent to an allowlisted address! However, there is a function to suspend all restrictions, making all tokens free float tokens.

## Limited Free Float

The use-case of having a limited free float is somewhat extraordinary and of special interest. Starting with all shares being restricted, a company could start setting some selected addresses to the 'free' type, thereby making the tokens on these addresses freely transferrable (at least until they are transferred to an allowlisted address again). For example, a company could declare all its treasury shares free float and then start selling them while keeping transfer restrictions for the existing shareholders in place.
