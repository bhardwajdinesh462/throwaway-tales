import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is a temporary email address?",
    answer: "A temporary email address is a disposable email that you can use for a short period. It's perfect for signing up for services without using your real email, protecting your privacy, and avoiding spam.",
  },
  {
    question: "How long do temporary emails last?",
    answer: "By default, temporary emails last for 1 hour. However, you can extend this duration or create a new email at any time. Premium users can save emails for longer periods.",
  },
  {
    question: "Is it free to use TrashMails?",
    answer: "Yes! TrashMails offers a completely free tier with unlimited email generation. Premium plans are available for additional features like custom domains and extended email history.",
  },
  {
    question: "Can I receive attachments?",
    answer: "Absolutely! TrashMails supports receiving email attachments including images, documents, and other files up to 10MB per email.",
  },
  {
    question: "Is my data secure?",
    answer: "We take privacy seriously. All emails are encrypted in transit, and we don't store any personal information. Emails are automatically deleted after expiration to ensure complete privacy.",
  },
  {
    question: "Can I reply to emails?",
    answer: "Currently, TrashMails is designed for receiving emails only. This helps maintain anonymity and prevents potential misuse of the service.",
  },
  {
    question: "Which websites block temporary emails?",
    answer: "Some websites may block known temporary email domains. We regularly add new domains to help bypass these restrictions. Premium users get access to exclusive, lesser-known domains.",
  },
  {
    question: "Do you have an API?",
    answer: "Yes! We offer a REST API for developers who want to integrate temporary email functionality into their applications. Check our documentation for more details.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="py-12 relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <span className="text-primary text-sm font-medium tracking-wider uppercase">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-4 text-foreground">
            Frequently Asked
            <span className="gradient-text"> Questions</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Got questions? We've got answers. If you can't find what you're looking for, feel free to contact us.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="glass-card border-none px-6"
              >
                <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
