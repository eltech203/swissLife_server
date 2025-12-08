const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require("../config/db");
// Import database connection
const router = express.Router();

router.use(cors());
router.use(bodyParser.json());
require("dotenv").config();


router.get('/', async (req, res) =>{
    res.send({
        publicKey: process.env.STRIPE_PUB_KEY
    });
})

// Deposit funds into wallet
router.post('/deposit', async (req, res) => {
    try {
        // const { amount, currency, paymentMethodId } = req.body;

        // Create a PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: "50" * 100, // Convert to cents
            currency:"USD",
            automatic_payment_methods: {enabled: true},
        });

        res.json({ success: true, client_secret: paymentIntent.client_secret});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/create-payment-intent', async (req, res) => {
    try {
        const { currency, paymentMethodType } = req.body;

        const amount = req.body.amount;
        const paymentIntent = await stripe.paymentIntents.create({
            amount:Number(amount), // Amount in smallest currency unit (e.g., cents)
            currency:"usd",
            automatic_payment_methods: {enabled: true}, // Supports card, mobilepay, bank transfer, etc.
        });
        console.log( "Key", paymentIntent.client_secret)
       return res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
       return res.status(500).json({ error: error.message });
    }
});


// Create Stripe Invoice
router.post("/create-invoice", async (req, res) => {
    try {
        const { email, description, amount } = req.body;

        // --- Step 1: Create or find customer ---
        // Try to find customer with matching email
        const existingCustomers = await stripe.customers.list({ email, limit: 1 });
        
        let customer;
        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            customer = await stripe.customers.create({ email });
        }

        // --- Step 2: Create an invoice item ---
        await stripe.invoiceItems.create({
            customer: customer.id,
            amount: Number(amount) * 100,   // Convert USD to cents
            currency: "usd",
            description: description || "Invoice Item",
        });

        // --- Step 3: Create the invoice ---
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            collection_method: "send_invoice",
            days_until_due: 3,   // invoice due in 3 days
        });

        // --- Step 4: Finalize the invoice ---
        const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

        return res.status(200).json({
            success: true,
            message: "Invoice created successfully",
            invoiceId: finalized.id,
            hosted_invoice_url: finalized.hosted_invoice_url,
            pdf: finalized.invoice_pdf,
        });

    } catch (error) {
        console.error("Invoice Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
});


router.post("/confirm-payment", async (req, res) => {
    const { paymentIntent,uid } = req.body;

    try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntent);

        if (intent.status === "succeeded") {
            console.log(`✅ Payment confirmed: ${paymentIntent} | Amount: ${intent.amount}`);
            let transactionHash = paymentIntent;
            res.json({
                success: true,
                message: "Payment confirmed , Deposit successful",
                amount: intent.amount, // Amount is in cents (Stripe default)
                currency: intent.currency
            });


            if (intent.status === 'succeeded') {
                // Update user wallet balance in MySQL
                await db.query(
                    "UPDATE users SET wallet_balance = wallet_balance + ? WHERE uid = ?",
                    [intent.amount, uid]
                );
              
               await db.query(
                    `INSERT INTO transactions (uid, amount, gold_equivalent, transaction_hash, type, status,wallet_type)
                     VALUES (?, ?, ?, ?, 'Deposit', 'Completed','Card')`,
                    [uid, intent.amount, "0", paymentIntent]
                );

                console.log(`✅ Deposit successful: ${paymentIntent} | Amount: ${intent.amount}`);
        
                 // Commit transaction

                // return res.json({ message: "Deposit successful" });
            } else {
                return res.status(400).json({ success: false, message: "Payment not successful" });
            }
   

        } else {
            res.json({ success: false, message: "Payment not confirmed yet" });
        }
    } catch (error) {
        console.error("Error retrieving payment intent:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


router.post("/withdraw", async (req, res) => {
    const { userId, amount } = req.body;
    const amountInCents = amount * 100;

    try {
        // Fetch user's Stripe account ID from MySQL
        // const [user] = await db.query("SELECT  wallet_balance FROM users WHERE id = ?", [userId]);

        // if (!user || !user[0].stripe_account_id) {
        //     return res.status(400).json({ success: false, message: "Stripe account not found." });
        // }

        // if (user[0].wallet_balance < amount) {
        //     return res.status(400).json({ success: false, message: "Insufficient balance." });
        // }

        // Create a test payout
        const payout = await stripe.payouts.create({
            amount: amountInCents,
            currency: "usd",
            method: "standard",
            destination: stripe_account_id, // Must be a bank account
        });

        // Deduct from MySQL wallet balance
        // await db.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE uid = ?", [amount, userId]);

        res.json({ success: true, message: "Test withdrawal initiated!", payoutId: payout.id });
    } catch (error) {
        console.error("Test Withdrawal Error:", error);
        res.status(500).json({ success: false, message: "Error processing test withdrawal." });
    }
});



module.exports = router;