# Allowlist

## Overview and Motivation

Small companies often have statutory transfer restrictions in place. As they grow, they typically tend to get rid of these restrictions
and abandon them entirely once they are publicly traded. This allowlist implementation is designed to flexibly and efficiently accompany the company on this journey. It is possible to have freely transferrable tokens and tokens that are subject to the allowlisting in parallelt, thereby supporting an incremental path from a completely controlled state to freely transferrable token with a gradually increasing free float. If necessary, the process also can be reverted again.

## Address Types

Generally, there are three types of addresses:
- Allowlisted addresses that can receive tokens from anyone, but only send to other allowlisted addresses. This is the default for the null address, so by default all minted tokens are restricted.
- Forbidden addresses that cannot receive any tokens but send to allowlisted addresses.
- Free addresses that can send to free and allowlisted addresses, but can only receive from free addresses. This is the default for new addresses.

Furthermore, it is possible to flag an address as powerlisted, allowing them to automatically allowlist transfer destinations. The null address is powerlisted by default, so one can mint new tokens without explicit allowlisting. Also, it might make sense to powerlist other company controlled addresses that are used for token distribution (e.g. a Brokerbot).

## Token Types

We distinguish between two token types, whereas their type depends on the address they reside on:
- Restricted tokens that can only be sent to allowlisted addresses
- Free float tokens that can be sent to any address except explicitely forbidden ones

The token type is not stored anywhere but implied by the address they reside on. So a free float token becomes a restricted token if sent to an allowlisted address! However, there is a function to suspend all restrictions, making all tokens free float tokens.

## Limited Free Float

The use-case of having a limited free float is somewhat extraordinary and of special interest. Starting with all shares being restricted, a company could start setting some selected addresses to the 'free' type, thereby making the tokens on these addresses freely transferrable (at least until they are transferred to an allowlisted address again). For example, a company could declare all its treasury shares free float and then start selling them while keeping transfer restrictions for the existing shareholders in place.
