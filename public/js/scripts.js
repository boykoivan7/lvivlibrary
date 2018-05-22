$('.message a').click(function(){
    $('form').animate({height: "toggle", opacity: "toggle"}, "slow");
});
     
$('.reloadbutton').click(function() {
    location.reload();
});

var path = "/"+window.location.pathname.split("/").pop();
$(`.toolmenu ul li a[href="${path}"]`).addClass('active');

$(".addbutton").attr("href", window.location.pathname + "/add");
$(".editbutton").attr("href", window.location.pathname + "/edit");
$(".remotebutton").attr("href", window.location.pathname + "/delete");

$("#change_logo").click(() => {
    var $parent = $("#change_logo").parent();
    $parent.html(`<input type="file" name="logo">`);
})

function change_icon(el, id)
{
    var ee = el.getElementsByTagName("i")[0];
    var ll= ee.className;
    if(ll === "fa fa-heart-o") {
        $.post( `/books/${id}/favouriteAdd`)
            .done(function( data ) {
                    ee.className = "fa fa-heart";
            });
    }
    else {
        $.post( `/books/${id}/favouriteDel`)
            .done(function( data ) {
                ee.className = "fa fa-heart-o";
            }); 
    }
}

function delete_favourite(id)
{
    $.post( `/books/${id}/favouriteDel`)
    .done(function( data ) {
        location.reload();
    }); 
}

if($(".second3 h3:first span").text().length > 31) {
	$(".first3 h3:first").append($("<p></p>").css("height", "3px"));
}
