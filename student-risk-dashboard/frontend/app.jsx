function uploadData() {
alert("Student data uploaded successfully!");
}

function generateMessage() {
let message = "Dear Parent, your child has been identified as needing additional academic support. Please contact the school for counseling and assistance.";
document.querySelector("textarea").value = message;
}

function checkSchemes() {
alert("Checking eligible government schemes for the student...");
}

document.addEventListener("DOMContentLoaded", function(){

let buttons = document.querySelectorAll("button");

buttons[0].addEventListener("click", uploadData);
buttons[1].addEventListener("click", generateMessage);
buttons[2].addEventListener("click", checkSchemes);

});
